import { defineConfig } from '@playwright/test';

// Port lu dans PLAYWRIGHT_PORT (3000 par défaut).
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
