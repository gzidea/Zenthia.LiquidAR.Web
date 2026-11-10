import { AxiosHeaders } from 'axios';
import { expect, it, vi } from 'vitest';
import { ApiClient } from './ApiClient';
import { deferred } from '@/test/fixtures';

it('envía el tenant solo a LiquidAR autenticado y permite consultar el catálogo sin filtro', async () => {
  const headers: AxiosHeaders[] = [];
  const hooks = {
    revision: () => 0,
    expire: vi.fn(),
    dataRevision: () => 1,
    dataTenant: () => 2,
  };
  const adapter = async (
    config: import('axios').InternalAxiosRequestConfig,
  ) => {
    headers.push(config.headers);
    return {
      data: true,
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
    };
  };
  const liquidar = new ApiClient(
    '/api',
    { ...hooks, getAccessToken: () => 'test-only' },
    adapter,
  );
  await liquidar.request('GET', '/empresas', undefined, {
    authenticated: true,
  });
  await liquidar.request('GET', '/contexto/tenants', undefined, {
    authenticated: true,
    tenantScoped: false,
  });
  await liquidar.request('GET', '/demo', undefined);
  await new ApiClient('/security', hooks, adapter).request(
    'GET',
    '/users/me',
    undefined,
    { authenticated: true },
  );
  expect(headers.map((h) => h.get('X-LiquidAR-Tenant-Id'))).toEqual([
    '2',
    undefined,
    undefined,
    undefined,
  ]);
  expect(headers[0]?.get('Authorization')).toBe('Bearer test-only');
});
it('descarta una respuesta tardía del contexto anterior sin cerrar la sesión', async () => {
  let scope = 1;
  const pending = deferred<void>();
  const expire = vi.fn();
  const client = new ApiClient(
    '/api',
    {
      revision: () => 0,
      dataRevision: () => scope,
      dataTenant: () => scope,
      getAccessToken: () => 'test-only',
      expire,
    },
    async (config) => {
      await pending.promise;
      return {
        data: ['old'],
        status: 200,
        statusText: 'OK',
        config,
        headers: new AxiosHeaders(),
      };
    },
  );
  const request = client.request('GET', '/empresas', undefined, {
    authenticated: true,
  });
  scope = 2;
  pending.resolve();
  await expect(request).rejects.toMatchObject({ kind: 'cancelled' });
  expect(expire).not.toHaveBeenCalled();
});
