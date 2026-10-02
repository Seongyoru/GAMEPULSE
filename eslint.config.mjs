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
}));

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
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
    name: 'gamepulse/tests',
    files: ['**/*.test.{ts,tsx}', '**/*.int.test.ts', 'apps/web/e2e/**/*.ts', '**/testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  prettier,
]);
