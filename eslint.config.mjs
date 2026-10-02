// @ts-check
import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const REACT_FILES = ['apps/web/**/*.{js,jsx,mjs,ts,tsx}', 'packages/ui/**/*.{ts,tsx}'];

/** eslint-config-next targets every file by default; scope it to the React code only. */
const scopedNext = nextVitals.map((config) => ({
  ...config,
  files: REACT_FILES,
  settings: { ...config.settings, next: { rootDir: 'apps/web/' } },
  rules: {
    ...config.rules,
    // App Router only: this rule targets the Pages Router.
    '@next/next/no-html-link-for-pages': 'off',
  },
}));

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    // Static preview export (GAMEPULSE_STATIC_EXPORT, docs/DEPLOYMENT.md).
    'apps/web/out/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/next-env.d.ts',
    'packages/database/drizzle/**',
    '.local/**',
  ]),

  js.configs.recommended,
  ...scopedNext,

  {
    name: 'gamepulse/typescript',
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/only-throw-error': 'error',
      'no-console': 'error',
    },
  },

  {
    name: 'gamepulse/javascript',
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    name: 'gamepulse/console-allowed',
    files: [
      'apps/worker/src/cli.ts',
      'apps/worker/src/cli/**/*.ts',
      'packages/database/src/cli/**/*.ts',
      'packages/observability/src/logger.ts',
      'scripts/**/*.{ts,mjs}',
      '**/*.config.{ts,mjs}',
      'apps/worker/build.mjs',
    ],
    rules: { 'no-console': 'off' },
  },

  {
    // Code that ships to the browser must stay free of Zod (~90 KB gzipped). Strict schemas
    // live in modules only the server imports (e.g. schemas/preferences-schema.ts).
    name: 'gamepulse/browser-bundle-budget',
    files: [
      'apps/web/src/components/**/*.{ts,tsx}',
      'apps/web/src/lib/**/*.{ts,tsx}',
      'packages/ui/src/**/*.{ts,tsx}',
      'packages/domain/src/{calendar,games,reset,status,time,today,urgency}/**/*.ts',
      'packages/domain/src/{constants,content,enums,identity,query,text}.ts',
      'packages/domain/src/schemas/preferences.ts',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'zod', message: 'Browser-facing code must not import Zod (bundle budget).' },
          ],
        },
      ],
    },
  },

  {
    name: 'gamepulse/tests',
    files: ['**/*.test.{ts,tsx}', '**/*.int.test.ts', 'apps/web/e2e/**/*.ts', '**/testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  prettier,
]);
