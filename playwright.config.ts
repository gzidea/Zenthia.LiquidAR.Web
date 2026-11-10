import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/lsd-real/**',
  outputDir: 'artifacts/browser',
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/browser-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5176',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5176`,
    url: 'http://localhost:5176',
    reuseExistingServer: false,
    // Test fixture only. No environment file or real ApplicationId is modified.
    env: {
      VITE_SECURITY_APPLICATION_ID: '42',
      VITE_SECURITY_BASE_URL: '/api',
      VITE_LIQUIDAR_BASE_URL: '/api',
      DEV_HTTPS_CERT: '',
      DEV_HTTPS_KEY: '',
    },
  },
});
