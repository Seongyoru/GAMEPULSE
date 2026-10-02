import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Test projects:
 *  - unit:        pure/unit tests (*.test.ts) — no network, no services
 *  - ui:          React component tests (*.test.tsx) in jsdom
 *  - integration: *.int.test.ts — PostgreSQL via TEST_DATABASE_URL, or embedded PGlite fallback
 * End-to-end tests live in apps/web/e2e and run with Playwright.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
          exclude: ['**/*.int.test.ts', '**/node_modules/**'],
          environment: 'node',
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          include: ['packages/*/src/**/*.test.tsx', 'apps/*/src/**/*.test.tsx'],
          exclude: ['**/node_modules/**'],
          environment: 'jsdom',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['packages/*/src/**/*.int.test.ts', 'apps/*/src/**/*.int.test.ts'],
          exclude: ['**/node_modules/**'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
