import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/services/http/ApiClient';
import { AxiosHeaders } from 'axios';
import { loginResponse } from '@/test/fixtures';
import { loginSessionSchema } from '../schemas/authSchemas';
import { useAuthStore } from '../stores/authStore';
import { AuthService } from './authService';
import {
  captureSessionTiming,
  captureServerSessionTiming,
} from './sessionClock';
import {
  canRequestWithSession,
  canResumeSession,
  sessionCredentials,
} from './sessionExpiry';
import {
  clearSessionTokens,
  getAccessToken,
  getSessionRemainingMs,
} from './sessionTokens';

let elapsed = 1000;
beforeEach(() => {
  vi.restoreAllMocks();
  elapsed = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
  useAuthStore.getState().clear('initial');
});
afterEach(() => vi.restoreAllMocks());

describe('sesión independiente del reloj de pared', () => {
  it.each([new Date('1990-01-01').getTime(), new Date('2099-01-01').getTime()])(
    'acepta login con la PC en %s y conserva los 30 segundos reales',
    async (wallClock) => {
      const response = loginResponse({
        accessTokenRemainingMilliseconds: 10_000,
      });
      vi.spyOn(Date, 'now').mockReturnValue(wallClock);
      const api = new ApiClient('/api', {
        revision: () => useAuthStore.getState().revision,
        expire: vi.fn(),
      });
      vi.spyOn(api, 'request').mockResolvedValue(response);
      await new AuthService(api, 42).login({
        userName: 'ana',
        password: 'test-only',
      });
      expect(getAccessToken()).toBe(response.accessToken);
      expect(getSessionRemainingMs()).toBe(10_000);
      vi.mocked(Date.now).mockReturnValue(wallClock + 30 * 86400000);
      expect(canRequestWithSession()).toBe(true);
      elapsed += 10_000;
      expect(getAccessToken()).toBeNull();
      expect(canRequestWithSession()).toBe(false);
      expect(canResumeSession()).toBe(true);
      elapsed += 29_999;
      expect(canResumeSession()).toBe(true);
      elapsed++;
      expect(canResumeSession()).toBe(false);
    },
  );

  it('descuenta el viaje de la petición y no reinicia el plazo al almacenar', async () => {
    const response = loginResponse({
      accessTokenRemainingMilliseconds: 10_000,
    });
    const api = new ApiClient('/api', {
      revision: () => useAuthStore.getState().revision,
      expire: vi.fn(),
    });
    vi.spyOn(api, 'request').mockImplementation(async () => {
      elapsed += 2000;
      return response;
    });
    await new AuthService(api, 42).login({
      userName: 'ana',
      password: 'test-only',
    });
    expect(getSessionRemainingMs()).toBe(8000);
  });

  it('distingue renovaciones aunque la fecha absoluta de vencimiento sea idéntica', () => {
    const response = loginResponse({
      accessTokenRemainingMilliseconds: 10_000,
    });
    const user = loginSessionSchema.parse(response);
    useAuthStore.getState().accept(user, response);
    const previous = sessionCredentials();
    const timing = captureSessionTiming(10_000);
    elapsed += 2500;
    useAuthStore.getState().renew(user, response, timing);
    expect(sessionCredentials()).not.toBe(previous);
    expect(getSessionRemainingMs()).toBe(7500);
    expect(JSON.stringify(sessionStorage)).not.toContain('deadline');
  });

  it.each(['initialize', 'resume'] as const)(
    'no regala el tiempo consumido por /users/me durante %s',
    async (operation) => {
      const response = loginResponse({
        accessTokenRemainingMilliseconds: 20_000,
      });
      useAuthStore
        .getState()
        .accept(
          loginSessionSchema.parse(response),
          response,
          captureSessionTiming(0, elapsed - 1000),
        );
      if (operation === 'initialize') {
        clearSessionTokens();
        useAuthStore.setState({ session: { status: 'initializing' } });
      }
      const api = new ApiClient('/api', {
        revision: () => useAuthStore.getState().revision,
        expire: vi.fn(),
      });
      vi.spyOn(api, 'request').mockImplementation(async (_, path) => {
        if (path === '/auth/refresh') {
          elapsed += 1000;
          return {
            ...response,
            accessTokenExpiry: response.expiresAt,
            refreshTokenExpiry: response.expiresAt,
          };
        }
        elapsed += 4000;
        return {
          user: { id: 7, userName: 'ana' },
          actor: { userId: 7, applicationId: 42, isSuperAdmin: false },
        };
      });
      await new AuthService(api, 42)[operation]();
      expect(getSessionRemainingMs()).toBe(15_000);
      expect(getAccessToken()).toBe(response.accessToken);
    },
  );

  it('rechaza la respuesta antigua sin duración, sin usar la hora de la PC', async () => {
    const { accessTokenRemainingMilliseconds: _, ...old } = loginResponse();
    const api = new ApiClient('/api', {
      revision: () => useAuthStore.getState().revision,
      expire: vi.fn(),
    });
    vi.spyOn(api, 'request').mockResolvedValue(old);
    await expect(
      new AuthService(api, 42).login({
        userName: 'ana',
        password: 'test-only',
      }),
    ).rejects.toHaveProperty('kind', 'contract');
    expect(getAccessToken()).toBeNull();
  });

  it.each([1990, 2040])(
    'acepta Security anterior usando Date del servidor con la PC en %s',
    async (year) => {
      const { accessTokenRemainingMilliseconds: _, ...old } = loginResponse({
        expiresAt: '2030-01-01T12:15:00Z',
      });
      vi.spyOn(Date, 'now').mockReturnValue(
        new Date(`${year}-01-01T12:00:00Z`).getTime(),
      );
      const api = new ApiClient(
        '/api',
        { revision: () => useAuthStore.getState().revision, expire: vi.fn() },
        async (config) => ({
          data: old,
          status: 200,
          statusText: 'OK',
          config,
          headers: new AxiosHeaders({
            Date: 'Tue, 01 Jan 2030 12:00:00 GMT',
            Age: '0',
          }),
        }),
      );
      await new AuthService(api, 42).login({
        userName: 'ana',
        password: 'test-only',
      });
      expect(getSessionRemainingMs()).toBe(899_000);
      expect(getAccessToken()).toBe(old.accessToken);
      vi.mocked(Date.now).mockReturnValue(new Date('2099-01-01').getTime());
      expect(getSessionRemainingMs()).toBe(899_000);
      elapsed += 899_000;
      expect(canResumeSession()).toBe(true);
    },
  );

  it.each(['initialize', 'resume'] as const)(
    'usa la referencia del servidor también en %s anterior',
    async (operation) => {
      const { accessTokenRemainingMilliseconds: _, ...old } = loginResponse({
        expiresAt: '2030-01-01T12:15:00Z',
      });
      useAuthStore
        .getState()
        .accept(
          loginSessionSchema.parse(old),
          undefined,
          captureSessionTiming(0, elapsed - 1000),
        );
      if (operation === 'initialize') {
        clearSessionTokens();
        useAuthStore.setState({ session: { status: 'initializing' } });
      }
      const api = new ApiClient(
        '/api',
        { revision: () => useAuthStore.getState().revision, expire: vi.fn() },
        async (config) => ({
          data:
            config.url === '/auth/refresh'
              ? {
                  ...old,
                  accessTokenExpiry: old.expiresAt,
                  refreshTokenExpiry: old.expiresAt,
                }
              : {
                  user: { id: 7, userName: 'ana' },
                  actor: { userId: 7, applicationId: 42, isSuperAdmin: false },
                },
          status: 200,
          statusText: 'OK',
          config,
          headers: new AxiosHeaders({ Date: 'Tue, 01 Jan 2030 12:00:00 GMT' }),
        }),
      );
      await new AuthService(api, 42)[operation]();
      expect(getAccessToken()).toBe(old.accessToken);
      expect(getSessionRemainingMs()).toBe(899_000);
    },
  );

  it.each(['missing', 'invalid', 'cached'])(
    'rechaza una referencia de servidor %s sin usar Date.now',
    async (mode) => {
      const { accessTokenRemainingMilliseconds: _, ...old } = loginResponse({
        expiresAt: '2030-01-01T12:15:00Z',
      });
      const headers = new AxiosHeaders();
      if (mode !== 'missing')
        headers.set(
          'date',
          mode === 'invalid' ? '1' : 'Tue, 01 Jan 2030 12:00:00 GMT',
        );
      if (mode === 'cached') headers.set('age', '60');
      const api = new ApiClient(
        '/api',
        { revision: () => useAuthStore.getState().revision, expire: vi.fn() },
        async (config) => ({
          data: old,
          status: 200,
          statusText: 'OK',
          config,
          headers,
        }),
      );
      await expect(
        new AuthService(api, 42).login({
          userName: 'ana',
          password: 'test-only',
        }),
      ).rejects.toMatchObject({
        kind: 'contract',
        message: expect.stringContaining('Security no informó'),
      });
      expect(getAccessToken()).toBeNull();
    },
  );

  it('prioriza la duración explícita y no sustituye un cero por Date', () => {
    expect(
      captureServerSessionTiming(
        0,
        '2030-01-01T12:15:00Z',
        'Tue, 01 Jan 2030 12:00:00 GMT',
        elapsed,
      ).deadline,
    ).toBe(elapsed);
    expect(
      captureServerSessionTiming(5000, '2030-01-01T12:15:00Z', null, elapsed)
        .deadline,
    ).toBe(elapsed + 5000);
  });
});
