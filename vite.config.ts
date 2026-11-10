import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (Boolean(env.DEV_HTTPS_CERT) !== Boolean(env.DEV_HTTPS_KEY)) {
    throw new Error(
      'DEV_HTTPS_CERT y DEV_HTTPS_KEY deben configurarse juntos.',
    );
  }
  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      watch: { ignored: ['**/artifacts/**'] },
      host: 'localhost',
      port: 5175,
      strictPort: true,
      https:
        env.DEV_HTTPS_CERT && env.DEV_HTTPS_KEY
          ? {
              cert: readFileSync(env.DEV_HTTPS_CERT),
              key: readFileSync(env.DEV_HTTPS_KEY),
            }
          : undefined,
      fs: {
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem,key,pfx}',
          '**/.git/**',
          '**/Zenthia.Security.Api/**',
          '**/Zenthia.LiquidAR/**',
        ],
      },
      proxy: {
        '/api': {
          target: 'https://gateway.zenthia.ar',
          changeOrigin: true,
          secure: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      clearMocks: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/test/**',
          'src/**/*.test.*',
          'src/main.tsx',
          'src/components/ui/DataGrid/examples/**',
          'src/components/ui/Modal/examples/**',
          'src/vite-env.d.ts',
          'src/features/auth/types/**',
        ],
        thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
      },
    },
  };
});
