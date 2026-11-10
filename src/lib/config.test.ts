import { describe, expect, it } from 'vitest';
import { readConfig } from './config';
function env(id?: string, url?: string): ImportMetaEnv {
  return {
    MODE: 'test',
    BASE_URL: '/',
    DEV: true,
    PROD: false,
    SSR: false,
    VITE_SECURITY_APPLICATION_ID: id,
    VITE_SECURITY_BASE_URL: url,
  };
}
describe('Configuración pública', () => {
  it.each([undefined, '', '0', '-1', 'abc', '1.5', '1e2', '2147483648'])(
    'rechaza ApplicationId %s',
    (id) => {
      expect(readConfig(env(id)).error).not.toBeNull();
    },
  );
  it('acepta un ID configurado y URL relativa del mismo origen', () => {
    expect(readConfig(env('42', '/api/'))).toEqual({
      applicationId: 42,
      baseURL: '/api',
      liquidarBaseURL: '/api',
      error: null,
    });
  });
  it.each([
    'https://example.test/api',
    '//example.test',
    '/api?secret=value',
    '/api#fragment',
    '/api\\other',
  ])('rechaza URL fuera del mecanismo same-origin: %s', (url) => {
    expect(readConfig(env('42', url)).error).not.toBeNull();
  });
});
