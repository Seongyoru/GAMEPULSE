import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against a production build serving synthetic fixtures. No external site is contacted:
 * every test runs on the local server, and fixture times are relative to the current hour.
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = `http://127.0.0.1:${PORT}`;

// Use a preinstalled Chromium when present (cloud sandboxes); CI installs browsers itself.
const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {};

const fixtureEnv = {
  GAMEPULSE_DATA_SOURCE: 'fixtures',
  GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION: 'true',
  NEXT_PUBLIC_ANALYTICS_PROVIDER: 'none',
  NEXT_PUBLIC_ADS_MODE: 'off',
  NEXT_TELEMETRY_DISABLED: '1',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions }, grep: /@mobile/ },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? `pnpm exec next start --port ${PORT}`
      : `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    url: baseURL,
    env: fixtureEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
