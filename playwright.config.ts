import { defineConfig, devices } from '@playwright/test';
import { E2E_AUTH } from './tests/e2e/auth-credentials';

const PORT = 9002;
// A second production server with DEMO_BASIC_AUTH set (CI only: it reuses the CI build).
const AUTH_PORT = 9003;
const inCI = !!process.env.CI;
// Point the suite at a deployed instance (e.g. the live demo) instead of starting a local server.
const remoteBaseURL = process.env.E2E_BASE_URL;
const withAuthServer = inCI && !remoteBaseURL;
// The AI call fails with this key, which exercises the dashboard's fallback guidance.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? 'e2e-placeholder';

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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /basic-auth\.spec\.ts/ },
    ...(withAuthServer
      ? [
          {
            name: 'basic-auth',
            testMatch: /basic-auth\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${AUTH_PORT}` },
          },
        ]
      : []),
  ],
  // Servers start in order, so the second one can serve the build the first one made.
  webServer: remoteBaseURL
    ? undefined
    : [
        {
          // CI tests the production build; locally the dev server starts faster.
          command: inCI ? `npm run build && npx next start -p ${PORT}` : `npm run dev`,
          url: `http://localhost:${PORT}`,
          reuseExistingServer: !inCI,
          timeout: 180_000,
          env: { GEMINI_API_KEY },
        },
        ...(withAuthServer
          ? [
              {
                command: `npx next start -p ${AUTH_PORT}`,
                // The health probe stays open, so readiness does not need credentials.
                url: `http://localhost:${AUTH_PORT}/api/health`,
                reuseExistingServer: false,
                timeout: 60_000,
                env: { GEMINI_API_KEY, DEMO_BASIC_AUTH: E2E_AUTH },
              },
            ]
          : []),
      ],
});
