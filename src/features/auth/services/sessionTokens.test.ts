import { beforeEach, expect, it, vi } from 'vitest';
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ApiClient } from '@/services/http/ApiClient';
import { useAuthStore } from '../stores/authStore';
import { loginSessionSchema } from '../schemas/authSchemas';
import { AuthService, expireSession, sessionHttpHooks } from './authService';
import { getAccessToken, clearSessionTokens } from './sessionTokens';
import { loginResponse, deferred } from '@/test/fixtures';

it('tras vencer y volver a ingresar envía el token nuevo y descarta un 401 atrasado', async () => {
  const now = Date.now();
  const time = vi.spyOn(Date, 'now').mockReturnValue(now);
  const previous = loginResponse({ accessToken: 'test-only-previous-access' });
  const current = loginResponse({
    accessToken: 'test-only-current-access',
    expiresAt: new Date(now + 1_900_000).toISOString(),
  });
  const security = new ApiClient('/api', {
    revision: () => useAuthStore.getState().revision,
    expire: expireSession,
  });
  vi.spyOn(security, 'request')
    .mockResolvedValueOnce(previous)
    .mockResolvedValueOnce(current);
  const auth = new AuthService(security, 42);
  await auth.login({ userName: 'ana', password: 'test-only-password' });
  const delayed = deferred<void>();
  let calls = 0;
  const liquidar = new ApiClient(
    '/api',
    { ...sessionHttpHooks, getAccessToken },
    async (config) => {
      calls++;
      expect(config.withCredentials).toBe(false);
      if (calls === 1) {
        expect(config.headers.get('Authorization')).toBe(
          'Bearer ' + previous.accessToken,
        );
        await delayed.promise;
        throw new AxiosError(
          'Test failure',
          'ERR_BAD_RESPONSE',
          config,
          undefined,
          {
            data: {},
            status: 401,
            statusText: 'Unauthorized',
            headers: new AxiosHeaders(),
            config,
          },
        );
      }
      expect(config.headers.get('Authorization')).toBe(
        'Bearer ' + current.accessToken,
      );
      return {
        data: { leer: true },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      };
    },
  );
  const pending = liquidar.request(
    'GET',
    '/liquidaciones/capacidades',
    undefined,
    { authenticated: true },
  );
  const rejected = expect(pending).rejects.toHaveProperty('kind', 'cancelled');
  time.mockReturnValue(now + 931_000);
  expireSession();
  expect(getAccessToken()).toBeNull();
  await auth.login({ userName: 'ana', password: 'test-only-password' });
  expect(getAccessToken()).toBe(current.accessToken);
  delayed.resolve();
  await rejected;
  expect(useAuthStore.getState().session.status).toBe('authenticated');
  await expect(
    liquidar.request('GET', '/liquidaciones/capacidades', undefined, {
      authenticated: true,
    }),
  ).resolves.toEqual({ leer: true });
  expect(calls).toBe(2);
});

beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().clear('initial');
  clearSessionTokens();
});
it('almacena ambos tokens de login y envía solo access token a LiquidAR, sin cookies', async () => {
  const response = loginResponse();
  const security = new ApiClient('/api', {
    revision: () => 0,
    expire: vi.fn(),
  });
  vi.spyOn(security, 'request').mockResolvedValue(response);
  await new AuthService(security, 42).login({
    userName: 'ana',
    password: 'fixture',
  });
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + response.accessToken,
    );
    expect(config.withCredentials).toBe(false);
    expect(JSON.stringify(config)).not.toContain(response.refreshToken);
    return {
      data: [],
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    };
  });
  const liquidar = new ApiClient(
    'http://localhost:5000/api',
    {
      revision: () => useAuthStore.getState().revision,
      expire: expireSession,
      getAccessToken,
    },
    adapter,
  );
  await liquidar.request('GET', '/sindicatos', undefined, {
    authenticated: true,
  });
  await new AuthService(security, 42).logout();
  expect(getAccessToken()).toBeNull();
  await expect(
    liquidar.request('GET', '/sindicatos', undefined, { authenticated: true }),
  ).rejects.toHaveProperty('status', 401);
  expect(adapter).toHaveBeenCalledTimes(1);
});
it('conserva tokens al cambiar contraseña, los elimina al expirar o reemplazar sesión', () => {
  const response = loginResponse();
  useAuthStore.getState().accept(loginSessionSchema.parse(response), response);
  useAuthStore.getState().passwordChanged();
  expect(getAccessToken()).toBe(response.accessToken);
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse(response.expiresAt) + 1);
  expect(getAccessToken()).toBe(response.accessToken);
  vi.spyOn(performance, 'now').mockReturnValue(
    performance.now() + response.accessTokenRemainingMilliseconds + 1,
  );
  expect(getAccessToken()).toBeNull();
  vi.restoreAllMocks();
  useAuthStore.getState().accept(loginSessionSchema.parse(response), response);
  useAuthStore.getState().accept(loginSessionSchema.parse(response));
  expect(getAccessToken()).toBeNull();
});
it('no adjunta Bearer a Security ni permite destinos absolutos en el cliente LiquidAR', async () => {
  const response = loginResponse();
  useAuthStore.getState().accept(loginSessionSchema.parse(response), response);
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    expect(config.headers.has('Authorization')).toBe(false);
    expect(config.withCredentials).toBe(true);
    return {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    };
  });
  await new ApiClient(
    '/api',
    { revision: () => 0, expire: vi.fn() },
    adapter,
  ).request('GET', '/users/me', undefined, { authenticated: true });
  const client = new ApiClient(
    '/api',
    { revision: () => 0, expire: vi.fn(), getAccessToken },
    adapter,
  );
  await expect(
    client.request('GET', 'https://other.example.test/api', undefined, {
      authenticated: true,
    }),
  ).rejects.toHaveProperty('kind', 'contract');
  expect(adapter).toHaveBeenCalledTimes(1);
});
