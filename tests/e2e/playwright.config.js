const { defineConfig } = require('@playwright/test');

const viewportWidths = [360, 390, 600, 768, 960, 1280, 1440];

module.exports = defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node ../../server.js',
    url: 'http://127.0.0.1:3000/login.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: viewportWidths.map((width) => ({
    name: `chromium-${width}px`,
    use: {
      viewport: { width, height: 900 },
    },
  })),
});

