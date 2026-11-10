import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const api = process.env.LSD_API_URL;
if (!api || !new URL(api).hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/))
  throw new Error('LSD real tests require the disposable loopback API host.');

export default defineConfig({
  testDir: '.',
  testMatch: 'libro-sueldos.real.spec.ts',
  outputDir: '../../artifacts/lsd-real/browser',
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: [
    ['list'],
    [
      'html',
      { outputFolder: '../../artifacts/lsd-real/report', open: 'never' },
    ],
    ['json', { outputFile: '../../artifacts/lsd-real/results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5178',
    channel: 'chrome',
    headless: true,
    // Requests contain a short-lived synthetic token; keep reports free of network traces.
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command:
      'node node_modules/vite/bin/vite.js --config e2e/lsd-real/vite.config.ts --host 127.0.0.1 --port 5178',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
    env: {
      LSD_API_URL: api,
      VITE_SECURITY_APPLICATION_ID: '1',
      VITE_SECURITY_BASE_URL: '/api',
      VITE_LIQUIDAR_BASE_URL: '/api',
      DEV_HTTPS_CERT: '',
      DEV_HTTPS_KEY: '',
    },
  },
});
