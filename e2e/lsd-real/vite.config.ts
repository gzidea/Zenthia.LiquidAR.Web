import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.config';

export default defineConfig(async (env) => {
  const api = process.env.LSD_API_URL;
  if (
    !api ||
    !new URL(api).hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/)
  )
    throw new Error('Only a disposable loopback API is allowed.');
  const base =
    typeof baseConfig === 'function' ? await baseConfig(env) : await baseConfig;
  return mergeConfig(base, {
    server: {
      https: false,
      proxy: { '/api': { target: api, changeOrigin: true, secure: false } },
    },
  });
});
