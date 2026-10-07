import { defineConfig, devices } from '@playwright/test';

const PORT = 9002;
const inCI = !!process.env.CI;
// Point the suite at a deployed instance (e.g. the live demo) instead of starting a local server.
const remoteBaseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 1 : 0,
  reporter: inCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: remoteBaseURL ?? `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: remoteBaseURL ? undefined : {
    // CI tests the production build; locally the dev server starts faster.
    command: inCI ? `npm run build && npx next start -p ${PORT}` : `npm run dev`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !inCI,
    timeout: 180_000,
    env: {
      // The AI call fails with this key, which exercises the dashboard's fallback guidance.
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? 'e2e-placeholder',
    },
  },
});
