// Mirrors the Supabase database (the one Vercel production reads and writes) into a Neon Postgres
// database, as a standby copy. Supabase stays the only database the app talks to; Neon is written
// by nothing but this script. Runs on a schedule from .github/workflows/neon-sync.yml, which does
// two jobs at once (ADR-024):
//
//   - Keep-alive. Supabase pauses a Free project after a week without database activity. Every
//     run opens a real connection and reads every table, which is that activity — even when the
//     Neon half of the run fails.
//   - Redundancy. Neon ends each run holding the same rows as Supabase. Both are Postgres built
//     from the same Prisma migrations, so promoting Neon is a DATABASE_URL/DIRECT_URL change in
//     Vercel, with no code change.
//
// Each run:
//   1. Guards: the two URLs must name different databases, Supabase must not carry the standby
//      marker, and Neon must be either empty or already marked as this script's standby.
//   2. `prisma migrate deploy` against Neon — the same migrations as Supabase, so a schema change
//      reaches the standby the first time this runs after CI's `migrate` job.
//   3. Reads every table from Supabase in one READ ONLY, REPEATABLE READ snapshot, every value as
//      its Postgres text form, so nothing is lost or shifted by `pg`'s JS parsing (timestamps
//      without a zone, enum arrays, jsonb).
//   4. In ONE Neon transaction: truncates every table, inserts the snapshot in foreign-key order,
//      checks the counts, records the run in `standby.sync_meta`, commits. If anything fails it
//      rolls back and Neon keeps the previous copy intact — it is never left half-written.
//
// Usage:
//   NEON_DIRECT_URL=... doppler run -- npx tsx scripts/sync-supabase-to-neon.ts
//
// Env: DIRECT_URL (Supabase, session-mode; falls back to DATABASE_URL) and NEON_DIRECT_URL
// (Neon's direct, non-pooled connection string — `prisma migrate deploy` can't run through
// Neon's pgbouncer pooler).

import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

loadEnv({ path: '.env.local' });
loadEnv();

/** Holds the marker that says "this database is a standby this script may overwrite". */
const META_SCHEMA = 'standby';
/** Postgres caps a statement at 65,535 bind parameters; stay far below it. */
const MAX_PARAMS_PER_INSERT = 10_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const SOURCE_URL = process.env.DIRECT_URL ?? requireEnv('DATABASE_URL');
const TARGET_URL = requireEnv('NEON_DIRECT_URL');

/** host/database, without credentials — safe to log. */
function describe(url: string): string {
  const u = new URL(url);
  return `${u.hostname}${u.pathname}`;
}

async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

async function hasSchema(client: pg.Client, schema: string): Promise<boolean> {
  const { rowCount } = await client.query(
    'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1',
    [schema],
  );
  return (rowCount ?? 0) > 0;
}

// ─── Table shapes ────────────────────────────────────────────────────────────────────────────

interface Table {
  name: string;
  columns: string[];
}

async function listColumns(client: pg.Client): Promise<Map<string, string[]>> {
  const { rows } = await client.query<{ table_name: string; column_name: string }>(
    `SELECT c.table_name, c.column_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        AND c.table_name <> '_prisma_migrations'
      ORDER BY c.table_name, c.ordinal_position`,
  );
  const tables = new Map<string, string[]>();
  for (const row of rows) {
    tables.set(row.table_name, [...(tables.get(row.table_name) ?? []), row.column_name]);
  }
  return tables;
}

/** Target tables, parents before children, so every insert's foreign keys already exist. */
async function orderedTables(target: pg.Client, columns: Map<string, string[]>): Promise<Table[]> {
  const { rows } = await target.query<{ child: string; parent: string }>(
    `SELECT con.conrelid::regclass::text AS child, con.confrelid::regclass::text AS parent
       FROM pg_constraint con
       JOIN pg_namespace n ON n.oid = con.connamespace
      WHERE con.contype = 'f' AND n.nspname = 'public'`,
  );
  const unquote = (name: string) => name.replace(/^"|"$/g, '');
  const parents = new Map<string, Set<string>>();
  for (const { child, parent } of rows) {
    if (child === parent) continue;
    const set = parents.get(unquote(child)) ?? new Set<string>();
    set.add(unquote(parent));
    parents.set(unquote(child), set);
  }

  const names = [...columns.keys()];
  const ordered: Table[] = [];
  const placed = new Set<string>();
  while (ordered.length < names.length) {
    const ready = names.filter(
      (name) => !placed.has(name) && [...(parents.get(name) ?? [])].every((p) => placed.has(p)),
    );
    if (ready.length === 0) throw new Error('Foreign-key cycle between tables; cannot order them.');
    for (const name of ready) {
      ordered.push({ name, columns: columns.get(name)! });
      placed.add(name);
    }
  }
  return ordered;
}

function assertSameShape(source: Map<string, string[]>, target: Map<string, string[]>): void {
  const problems: string[] = [];
  for (const name of new Set([...source.keys(), ...target.keys()])) {
    const s = source.get(name);
    const t = target.get(name);
    if (!s || !t) {
      problems.push(`table "${name}" only on ${s ? 'Supabase' : 'Neon'}`);
      continue;
    }
    const missing = t.filter((c) => !s.includes(c));
    const extra = s.filter((c) => !t.includes(c));
    if (missing.length || extra.length) {
      problems.push(
        `"${name}": only on Neon [${missing.join(', ')}], only on Supabase [${extra.join(', ')}]`,
      );
    }
  }
  if (problems.length > 0) {
    // Usually a run that started between a merge to main and CI's `migrate` job reaching
    // Supabase. The snapshot read already counted as Supabase activity; the next run catches up.
    throw new Error(
      `Supabase and Neon schemas differ (a migration not applied to Supabase yet?): ${problems.join('; ')}.`,
    );
  }
}

// ─── Copy ────────────────────────────────────────────────────────────────────────────────────

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function readSnapshot(
  source: pg.Client,
  tables: Table[],
): Promise<Map<string, (string | null)[][]>> {
  const rows = new Map<string, (string | null)[][]>();
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    for (const table of tables) {
      // `::text` everywhere: the value goes back in as an untyped parameter and Postgres casts it
      // to the column's own type, which round-trips every type in this schema exactly.
      const select = table.columns.map((c) => `${q(c)}::text`).join(', ');
      const result = await source.query({
        text: `SELECT ${select} FROM ${q(table.name)}`,
        rowMode: 'array',
      });
      rows.set(table.name, result.rows as (string | null)[][]);
    }
    await source.query('COMMIT');
  } catch (error) {
    await source.query('ROLLBACK');
    throw error;
  }
  return rows;
}

async function writeSnapshot(
  target: pg.Client,
  tables: Table[],
  rows: Map<string, (string | null)[][]>,
  sourceLabel: string,
): Promise<void> {
  await target.query('BEGIN');
  try {
    await target.query(`TRUNCATE ${tables.map((t) => q(t.name)).join(', ')}`);

    for (const table of tables) {
      const all = rows.get(table.name)!;
      const width = table.columns.length;
      const perBatch = Math.max(1, Math.floor(MAX_PARAMS_PER_INSERT / width));
      for (let i = 0; i < all.length; i += perBatch) {
        const batch = all.slice(i, i + perBatch);
        const values = batch
          .map((_, r) => `(${table.columns.map((_, c) => `$${r * width + c + 1}`).join(', ')})`)
          .join(', ');
        await target.query(
          `INSERT INTO ${q(table.name)} (${table.columns.map(q).join(', ')}) VALUES ${values}`,
          batch.flat(),
        );
      }
    }

    const wrong: string[] = [];
    for (const table of tables) {
      const { rows: count } = await target.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM ${q(table.name)}`,
      );
      const expected = rows.get(table.name)!.length;
      if (Number(count[0].n) !== expected) {
        wrong.push(`${table.name}: Supabase ${expected}, Neon ${count[0].n}`);
      }
    }
    if (wrong.length > 0) throw new Error(`Row counts differ after copy: ${wrong.join('; ')}`);

    const meta = {
      synced_at: new Date().toISOString(),
      source: sourceLabel,
      row_counts: JSON.stringify(Object.fromEntries([...rows].map(([t, r]) => [t, r.length]))),
    };
    for (const [key, value] of Object.entries(meta)) {
      await target.query(
        `INSERT INTO ${META_SCHEMA}.sync_meta (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    }
    await target.query('COMMIT');
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const sourceLabel = describe(SOURCE_URL);
  const targetLabel = describe(TARGET_URL);
  if (sourceLabel === targetLabel) {
    throw new Error(`DIRECT_URL and NEON_DIRECT_URL both point at ${sourceLabel}.`);
  }
  console.log(`Supabase ${sourceLabel} → Neon ${targetLabel}`);

  const source = await connect(SOURCE_URL);
  const target = await connect(TARGET_URL);
  try {
    if (await hasSchema(source, META_SCHEMA)) {
      throw new Error(
        `The source has a "${META_SCHEMA}" schema, so it is a standby copy itself. Check DIRECT_URL.`,
      );
    }

    if (!(await hasSchema(target, META_SCHEMA))) {
      const { rows } = await target.query<{ n: string }>(
        "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'public'",
      );
      if (Number(rows[0].n) > 0) {
        throw new Error(
          `Neon ${targetLabel} already has tables but no "${META_SCHEMA}" marker, so this script ` +
            'did not create it. Point NEON_DIRECT_URL at a new, empty database.',
        );
      }
      await target.query(
        `CREATE SCHEMA ${META_SCHEMA};
         CREATE TABLE ${META_SCHEMA}.sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         INSERT INTO ${META_SCHEMA}.sync_meta VALUES ('standby_of', '${sourceLabel}');`,
      );
      console.log(`Marked ${targetLabel} as the standby copy.`);
    }

    // prisma.config.ts reads DIRECT_URL; an explicit env var wins over its dotenv files.
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      env: { ...process.env, DIRECT_URL: TARGET_URL },
    });

    const sourceColumns = await listColumns(source);
    const targetColumns = await listColumns(target);
    assertSameShape(sourceColumns, targetColumns);
    const tables = await orderedTables(target, targetColumns);

    const rows = await readSnapshot(source, tables);
    const total = [...rows.values()].reduce((sum, r) => sum + r.length, 0);
    console.log(`Read ${total} rows from ${tables.length} tables on Supabase.`);

    await writeSnapshot(target, tables, rows, sourceLabel);
    console.log(`Neon now matches Supabase on all ${tables.length} tables (${total} rows).`);
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
