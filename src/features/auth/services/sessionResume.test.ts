import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { deferred, loginResponse } from '@/test/fixtures';
import { loginSessionSchema } from '../schemas/authSchemas';
import { useAuthStore } from '../stores/authStore';
import { AuthService, expireSession, sessionHttpHooks } from './authService';
import { getAccessToken } from './sessionTokens';
import { captureSessionTiming } from './sessionClock';

const identity = {
  user: { id: 7, userName: 'ana' },
  actor: { userId: 7, applicationId: 42, isSuperAdmin: false },
};
const api = new ApiClient('/api', sessionHttpHooks);

function expiredSession(required = false) {
  const response = loginResponse({
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    requiresPasswordChange: required,
    firstLogin: required,
  });
  useAuthStore
    .getState()
    .accept(
      loginSessionSchema.parse(response),
      response,
      captureSessionTiming(0, performance.now() - 1000),
    );
  return response;
}

function tokens() {
  return {
    accessTokenRemainingMilliseconds: 900_000,
    accessToken: 'test-only-renewed-access',
    refreshToken: 'test-only-renewed-refresh',
    accessTokenExpiry: new Date(Date.now() + 900_000).toISOString(),
    refreshTokenExpiry: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().clear('initial');
});
afterEach(() => vi.useRealTimers());

describe('Retomar sesión vencida', () => {
  it.each([false, true])(
    'renueva sin cambiar revisión ni bloqueo de clave (%s), deduplica clics',
    async (required) => {
      expiredSession(required);
      const revision = useAuthStore.getState().revision;
      const renewed = tokens();
      const request = vi
        .spyOn(api, 'request')
        .mockResolvedValueOnce(renewed)
        .mockResolvedValueOnce(identity);
      const service = new AuthService(api, 42);
      const first = service.resume();
      expect(service.resume()).toBe(first);
      await first;
      expect(request.mock.calls.map((call) => call[1])).toEqual([
        '/auth/refresh',
        '/users/me',
      ]);
      expect(useAuthStore.getState().revision).toBe(revision);
      expect(useAuthStore.getState().session.status).toBe(
        required ? 'password-required' : 'authenticated',
      );
      expect(getAccessToken()).toBe(renewed.accessToken);
      expect(JSON.stringify(useAuthStore.getState())).not.toContain(
        renewed.refreshToken,
      );
      expect(JSON.stringify(sessionStorage)).not.toContain(renewed.accessToken);
    },
  );

  it('permite reintentar un fallo temporal dentro del plazo', async () => {
    expiredSession();
    const request = vi
      .spyOn(api, 'request')
      .mockRejectedValueOnce(new ApiError('network', 'Sin conexión.'))
      .mockResolvedValueOnce(tokens())
      .mockResolvedValueOnce(identity);
    const service = new AuthService(api, 42);
    await expect(service.resume()).rejects.toHaveProperty('kind', 'network');
    expect(useAuthStore.getState().session.status).toBe('authenticated');
    await service.resume();
    expect(request).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).not.toBeNull();
  });

  it.each(['refresh', 'identity'])(
    'cierra si Security rechaza %s',
    async (step) => {
      expiredSession();
      const request = vi.spyOn(api, 'request');
      if (step === 'identity') request.mockResolvedValueOnce(tokens());
      request.mockRejectedValueOnce(
        new ApiError('authentication', 'Rechazado', 401),
      );
      await expect(new AuthService(api, 42).resume()).rejects.toHaveProperty(
        'status',
        401,
      );
      expect(useAuthStore.getState().session.status).toBe('anonymous');
      expect(getAccessToken()).toBeNull();
    },
  );

  it.each([0, 99])(
    'no acepta otro usuario o aplicación (%s)',
    async (value) => {
      expiredSession();
      vi.spyOn(api, 'request')
        .mockResolvedValueOnce(tokens())
        .mockResolvedValueOnce({
          ...identity,
          actor: { ...identity.actor, applicationId: value },
        });
      await expect(new AuthService(api, 42).resume()).rejects.toBeInstanceOf(
        ApiError,
      );
      expect(getAccessToken()).toBeNull();
    },
  );

  it('no restaura una respuesta recibida fuera de los 30 segundos', async () => {
    vi.useFakeTimers();
    expiredSession();
    const pending = deferred<unknown>();
    vi.spyOn(api, 'request').mockReturnValue(pending.promise);
    const resuming = new AuthService(api, 42).resume();
    vi.advanceTimersByTime(30_000);
    pending.resolve(tokens());
    await expect(resuming).rejects.toHaveProperty('status', 401);
    expect(useAuthStore.getState().session.status).toBe('anonymous');
  });

  it('descarta respuesta atrasada después del cierre local', async () => {
    expiredSession();
    const pending = deferred<unknown>();
    vi.spyOn(api, 'request').mockReturnValue(pending.promise);
    const resuming = new AuthService(api, 42).resume();
    expireSession();
    pending.resolve(tokens());
    await expect(resuming).rejects.toHaveProperty('kind', 'cancelled');
    expect(getAccessToken()).toBeNull();
  });

  it.each([30_000, 60_000])(
    'rechaza renovar fuera del plazo (%s ms)',
    async (elapsed) => {
      const response = loginResponse({
        expiresAt: new Date(Date.now() - elapsed).toISOString(),
      });
      useAuthStore
        .getState()
        .accept(
          loginSessionSchema.parse(response),
          response,
          captureSessionTiming(0, performance.now() - elapsed),
        );
      const request = vi.spyOn(api, 'request');
      await expect(new AuthService(api, 42).resume()).rejects.toHaveProperty(
        'status',
        401,
      );
      expect(request).not.toHaveBeenCalled();
    },
  );

  it('bloquea escrituras sin enviarlas ni perder la sesión pausada', async () => {
    expiredSession();
    const adapter = vi.fn();
    const client = new ApiClient(
      '/api',
      { ...sessionHttpHooks, getAccessToken },
      adapter,
    );
    await expect(
      client.request('POST', '/sindicatos', {}, { authenticated: true }),
    ).rejects.toHaveProperty('status', 401);
    expect(adapter).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session.status).toBe('authenticated');
  });

  it('un 401 anterior a expirar sigue cerrando la sesión', async () => {
    const response = loginResponse();
    useAuthStore
      .getState()
      .accept(loginSessionSchema.parse(response), response);
    const client = new ApiClient('/api', sessionHttpHooks, async (config) => {
      throw new AxiosError('Rechazado', 'ERR_BAD_RESPONSE', config, undefined, {
        data: {},
        status: 401,
        statusText: 'Unauthorized',
        config,
        headers: new AxiosHeaders(),
      });
    });
    await expect(
      client.request('GET', '/users/me', undefined, { authenticated: true }),
    ).rejects.toHaveProperty('status', 401);
    expect(useAuthStore.getState().session.status).toBe('anonymous');
  });

  it('un 401 de las credenciales anteriores no cierra la sesión retomada ni reenvía la escritura', async () => {
    const response = loginResponse();
    useAuthStore
      .getState()
      .accept(loginSessionSchema.parse(response), response);
    const pending = deferred<void>();
    const adapter = vi.fn(async (config) => {
      await pending.promise;
      throw new AxiosError('Rechazado', 'ERR_BAD_RESPONSE', config, undefined, {
        data: {},
        status: 401,
        statusText: 'Unauthorized',
        config,
        headers: new AxiosHeaders(),
      });
    });
    const client = new ApiClient(
      '/api',
      { ...sessionHttpHooks, getAccessToken },
      adapter,
    );
    const saving = client.request(
      'PUT',
      '/sindicatos/7',
      {},
      { authenticated: true },
    );
    useAuthStore.getState().renew(
      {
        ...loginSessionSchema.parse(response),
        expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
      },
      tokens(),
    );
    pending.resolve();
    await expect(saving).rejects.toHaveProperty('kind', 'cancelled');
    expect(useAuthStore.getState().session.status).toBe('authenticated');
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
