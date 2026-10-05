// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// esbuild ships with Vite, which Vitest runs on; it stands in here for the production minifier,
// which honours the same `@__PURE__` annotation.
import { build } from 'esbuild';

// The admin mailbox's full address must not reach the browser (ADR-023). The login, reset and
// security pages pass the masked form down from the server; the client components only import
// numbers and codes from ../auth-policy.ts — which also defines the address. These tests keep both
// halves honest: no client file imports the address, and importing the rest of the policy file
// doesn't drag it into a minified bundle.

const AUTH_DIR = fileURLToPath(new URL('../..', import.meta.url));
const UI_DIR = path.join(AUTH_DIR, 'ui');
const POLICY = path.join(AUTH_DIR, 'auth-policy.ts');
const ADDRESS = 'culpritteam@gmail.com';

async function bundle(source: string): Promise<string> {
  const result = await build({
    stdin: { contents: source, resolveDir: AUTH_DIR, loader: 'ts' },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    write: false,
  });
  return result.outputFiles[0]!.text;
}

const FORBIDDEN = ['ADMIN_EMAIL', 'ADMIN_EMAIL_MASKED', 'maskEmail'];

/**
 * Every way a client source file could pull the address in, as human-readable findings:
 *  - a named import or re-export of the address or its helpers, from any module;
 *  - a namespace import (`import * as p`) of the policy file — every export comes along;
 *  - any re-export from the policy file (`export * from` / `export { … } from`), which would make a
 *    UI module a second door to it;
 *  - a dynamic `import()` of the policy file.
 */
function addressImportFindings(source: string): string[] {
  const findings: string[] = [];
  // `[^;]` keeps a match inside one statement (an import clause never contains `;`).
  const statement = /\b(import|export)\s+(type\s+)?([^;]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(statement)) {
    const [, keyword, , clause = '', from = ''] = match;
    const fromPolicy = /(^|\/)auth-policy(\.ts)?$/.test(from);
    const named = /\{([^}]*)\}/.exec(clause)?.[1] ?? '';
    const names = named
      .split(',')
      .map((part) =>
        part
          .trim()
          .split(/\s+as\s+/)[0]!
          .replace(/^type\s+/, '')
          .trim(),
      )
      .filter(Boolean);
    const hit = names.find((name) => FORBIDDEN.includes(name));
    if (hit) findings.push(`${keyword} of ${hit} from ${from}`);
    if (fromPolicy && /\*\s+as\s+\w+/.test(clause)) findings.push(`namespace import of ${from}`);
    if (fromPolicy && keyword === 'export') findings.push(`re-export from ${from}`);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]*auth-policy[^'"]*)['"]/g)) {
    findings.push(`dynamic import of ${match[1]}`);
  }
  return findings;
}

describe('the admin mailbox in client code', () => {
  it('is not imported by any auth UI file', () => {
    const files = readdirSync(UI_DIR).filter((name) => /\.tsx?$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const source = readFileSync(path.join(UI_DIR, name), 'utf8');
      expect(addressImportFindings(source), name).toEqual([]);
    }
  });

  it.each([
    ["import { ADMIN_EMAIL } from '../auth-policy';", 'import of ADMIN_EMAIL'],
    [
      "import {\n  CODE_DIGITS,\n  ADMIN_EMAIL_MASKED as masked,\n} from '../auth-policy';",
      'import of ADMIN_EMAIL_MASKED',
    ],
    ["import { maskEmail } from '@/modules/auth';", 'import of maskEmail'],
    ["import * as policy from '../auth-policy';", 'namespace import'],
    ["import * as policy from '../auth-policy.ts';", 'namespace import'],
    ["export * from '../auth-policy';", 're-export'],
    ["export { CODE_DIGITS } from '../auth-policy';", 're-export'],
    ["export { ADMIN_EMAIL as A } from './somewhere';", 'export of ADMIN_EMAIL'],
    ["const p = await import('../auth-policy');", 'dynamic import'],
    [
      "export const unrelated = 1;\nimport * as policy from '../auth-policy';",
      'namespace import of ../auth-policy',
    ],
  ])('the check catches %s', (source, finding) => {
    expect(addressImportFindings(source).join('; ')).toContain(finding);
  });

  it('the check allows the harmless numbers and codes', () => {
    expect(
      addressImportFindings(
        "import { CAPTCHA_HEADER, CODE_DIGITS, type PASSWORD_POLICY } from '../auth-policy';",
      ),
    ).toEqual([]);
  });

  it('is dropped from a bundle that imports only the rest of the policy', async () => {
    const code = await bundle(
      `import { CODE_DIGITS, CODE_TTL_MINUTES, PASSWORD_POLICY, CAPTCHA_HEADER } from ${JSON.stringify(POLICY)};
       console.log(CODE_DIGITS, CODE_TTL_MINUTES, PASSWORD_POLICY, CAPTCHA_HEADER);`,
    );
    expect(code).toContain('x-captcha-response');
    expect(code).not.toContain(ADDRESS);
  });

  it('would be caught: importing the masked form does bundle the full address', async () => {
    const code = await bundle(
      `import { ADMIN_EMAIL_MASKED } from ${JSON.stringify(POLICY)}; console.log(ADMIN_EMAIL_MASKED);`,
    );
    expect(code).toContain(ADDRESS);
  });
});
