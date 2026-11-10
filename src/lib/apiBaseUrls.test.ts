import { expect, it } from 'vitest';
import { readConfig } from './config';
const env: ImportMetaEnv = {
  MODE: 'test',
  BASE_URL: '/',
  DEV: true,
  PROD: false,
  SSR: false,
  VITE_SECURITY_APPLICATION_ID: '42',
};
it('separa Security en producción de LiquidAR local y normaliza la barra final', () => {
  const config = readConfig({
    ...env,
    VITE_SECURITY_BASE_URL: 'https://security.example.test/api/',
    VITE_LIQUIDAR_BASE_URL: 'http://localhost:5100/api/',
  });
  expect(config.baseURL).toBe('https://security.example.test/api');
  expect(config.liquidarBaseURL).toBe('http://localhost:5100/api');
});
it('mantiene /api por defecto y no deriva LiquidAR desde la URL de Security', () => {
  const config = readConfig({
    ...env,
    VITE_SECURITY_BASE_URL: 'https://security.example.test/api',
  });
  expect(config.liquidarBaseURL).toBe('/api');
  expect(readConfig(env).baseURL).toBe('/api');
});
it('permite rutas relativas independientes para proxies', () => {
  const config = readConfig({
    ...env,
    VITE_SECURITY_BASE_URL: '/security/api/',
    VITE_LIQUIDAR_BASE_URL: '/liquidar/api/',
  });
  expect(config.baseURL).toBe('/security/api');
  expect(config.liquidarBaseURL).toBe('/liquidar/api');
});
