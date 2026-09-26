import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    // The ESLint CLI lints the whole repository (`next lint` only walked src/). Generated output,
    // build and test artefacts and vendored documentation assets are not source.
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'docs/**',
      'docs-site/**',
      '.claude/**',
      '.reports/**',
    ],
  },
];

export default eslintConfig;
