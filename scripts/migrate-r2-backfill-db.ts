// One-off: rewrites the R2 public-URL host stored on TeamMember.photoUrl, Event.photoUrls[] and
// EventParticipant.photoUrl after migrate-r2-copy.ts has copied the objects to the client's
// bucket. Object keys never change (see that script), so this is a plain string-prefix swap, not
// a key rewrite. Run once, after the copy script, before the app is cut over to the new
// R2_PUBLIC_URL — the DB and the storage account must agree on which host serves the images.
//
// Usage:
//   DATABASE_URL=... R2_PUBLIC_URL=<old host> R2_DEST_PUBLIC_URL=<new host> \
//   npx tsx scripts/migrate-r2-backfill-db.ts --dry-run   # preview only, always safe
//   npx tsx scripts/migrate-r2-backfill-db.ts --yes       # writes, after confirming below
//
// Refuses to write unless migrate-r2-copy.ts's manifest (scripts/.r2-migration-manifest.json)
// exists and reports zero failures — pass --force to override (e.g. the manifest predates a
// retried run you've separately confirmed succeeded).
//
// CLAUDE.md: staging and production currently share one Supabase database, so this is a
// production write. It prints the resolved DB host (never credentials) before touching anything,
// and --yes is required for a live run so it's never triggered by a stray Enter key.

import { readFile } from 'node:fs/promises';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

const DRY_RUN = process.argv.includes('--dry-run');
const CONFIRMED = process.argv.includes('--yes');
const FORCE = process.argv.includes('--force');
const MANIFEST_PATH = new URL('.r2-migration-manifest.json', import.meta.url);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value.replace(/\/+$/, '');
}

const OLD_URL = requireEnv('R2_PUBLIC_URL');
const NEW_URL = requireEnv('R2_DEST_PUBLIC_URL');

if (OLD_URL === NEW_URL) {
  throw new Error('R2_PUBLIC_URL and R2_DEST_PUBLIC_URL are identical — nothing to backfill.');
}

if (!DRY_RUN && !CONFIRMED) {
  throw new Error('Live run requires --yes (or use --dry-run to preview first).');
}

async function checkCopyManifest(): Promise<void> {
  if (FORCE) {
    console.log('--force set: skipping the migrate-r2-copy.ts manifest check.');
    return;
  }
  let raw: string;
  try {
    raw = await readFile(MANIFEST_PATH, 'utf-8');
  } catch {
    throw new Error(
      `No copy manifest found at ${MANIFEST_PATH.pathname}. Run migrate-r2-copy.ts first, or pass --force if you've verified the copy separately.`
    );
  }
  const manifest = JSON.parse(raw) as { failed: unknown[] };
  if (manifest.failed.length > 0) {
    throw new Error(
      `migrate-r2-copy.ts's manifest reports ${manifest.failed.length} failed object(s) — fix and re-run the copy before backfilling the DB, or pass --force to proceed anyway.`
    );
  }
}

const { prisma } = await import('../src/modules/shared/lib/prisma');

function swap(url: string): string {
  return url.startsWith(OLD_URL) ? NEW_URL + url.slice(OLD_URL.length) : url;
}

/** Host only, no credentials — safe to print. */
function dbHost(): string {
  try {
    return new URL(requireEnv('DATABASE_URL')).host;
  } catch {
    return '(unable to parse DATABASE_URL)';
  }
}

async function main() {
  if (!DRY_RUN) await checkCopyManifest();

  console.log(`Target database: ${dbHost()}`);
  console.log(`Rewriting "${OLD_URL}" -> "${NEW_URL}"${DRY_RUN ? ' (dry run — no writes)' : ''}`);

  const teamMembers = await prisma.teamMember.findMany({
    where: { photoUrl: { startsWith: OLD_URL } },
    select: { id: true, photoUrl: true },
  });

  const participants = await prisma.eventParticipant.findMany({
    where: { photoUrl: { startsWith: OLD_URL } },
    select: { id: true, photoUrl: true },
  });

  const events = await prisma.event.findMany({
    where: { photoUrls: { isEmpty: false } },
    select: { id: true, photoUrls: true },
  });
  const eventsToUpdate = events
    .map((e) => ({ id: e.id, photoUrls: e.photoUrls.map(swap) }))
    .filter((e, i) => e.photoUrls.some((url, j) => url !== events[i].photoUrls[j]));

  console.log(
    `Found ${teamMembers.length} team member(s), ${eventsToUpdate.length} event(s), ${participants.length} participant(s) to update.`
  );

  if (DRY_RUN) return;

  // Plain sequential writes, not one big $transaction: each row's swap() is idempotent and
  // independent (an interrupted run just re-matches fewer rows on `WHERE ... startsWith` next
  // time), so there's no atomicity to buy here — only a shared 5s transaction timeout to risk on
  // a slow connection.
  for (const m of teamMembers) {
    await prisma.teamMember.update({ where: { id: m.id }, data: { photoUrl: swap(m.photoUrl!) } });
  }
  for (const e of eventsToUpdate) {
    await prisma.event.update({ where: { id: e.id }, data: { photoUrls: e.photoUrls } });
  }
  for (const p of participants) {
    await prisma.eventParticipant.update({ where: { id: p.id }, data: { photoUrl: swap(p.photoUrl!) } });
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
