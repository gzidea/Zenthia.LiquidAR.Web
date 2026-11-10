import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/services/http/ApiClient';
import { changedUser, deferred, loginResponse } from '@/test/fixtures';
import {
  loginSessionSchema,
  changePasswordSchema,
} from '../schemas/authSchemas';
import { useAuthStore } from '../stores/authStore';
import { AuthService, expireSession } from './authService';
import { clearSessionTokens, getAccessToken } from './sessionTokens';
import { readSessionContext } from './sessionContext';
import { ApiError } from '@/services/http/ApiError';

const api = new ApiClient('/api', {
  revision: () => useAuthStore.getState().revision,
  expire: expireSession,
});
const fields = {
  currentPassword: 'actual',
  newPassword: 'nueva',
  confirmPassword: 'nueva',
};
const login = { userName: 'ana', password: 'temporal' };
beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ session: { status: 'initializing' }, revision: 0 });
});

describe('AuthService', () => {
  it.each([false, true])(
    'restaura tras recarga, conserva bloqueo %s y deduplica refresh',
    async (required) => {
      const response = loginResponse({
        requiresPasswordChange: required,
        firstLogin: required,
      });
      useAuthStore
        .getState()
        .accept(loginSessionSchema.parse(response), response);
      clearSessionTokens();
      useAuthStore.setState({ session: { status: 'initializing' } });
      const request = vi
        .spyOn(api, 'request')
        .mockResolvedValueOnce({
          ...response,
          accessTokenExpiry: response.expiresAt,
          refreshTokenExpiry: response.expiresAt,
        })
        .mockResolvedValueOnce({
          user: { id: response.userId, userName: response.userName },
          actor: {
            userId: response.userId,
            applicationId: 42,
            isSuperAdmin: false,
          },
        });
      const service = new AuthService(api, 42);
      await Promise.all([service.initialize(), service.initialize()]);
      expect(request.mock.calls.map((call) => call[1])).toEqual([
        '/auth/refresh',
        '/users/me',
      ]);
      expect(useAuthStore.getState().session.status).toBe(
        required ? 'password-required' : 'authenticated',
      );
      expect(getAccessToken()).toBe(response.accessToken);
      expect(JSON.stringify(readSessionContext())).not.toContain(
        response.accessToken,
      );
      expect(readSessionContext()).not.toHaveProperty('refreshToken');
    },
  );
  it.each([401, 500])(
    'maneja refresh fallido %s sin restaurar acceso',
    async (status) => {
      useAuthStore.getState().accept(loginSessionSchema.parse(loginResponse()));
      useAuthStore.setState({ session: { status: 'initializing' } });
      vi.spyOn(api, 'request').mockRejectedValue(
        new ApiError(
          status === 401 ? 'authentication' : 'server',
          'Error',
          status,
        ),
      );
      await new AuthService(api, 42).initialize();
      expect(useAuthStore.getState().session.status).toBe(
        status === 401 ? 'anonymous' : 'restore-error',
      );
      expect(readSessionContext() === null).toBe(status === 401);
    },
  );
  it('descarta restauración atrasada después de invalidar sesión', async () => {
    useAuthStore.getState().accept(loginSessionSchema.parse(loginResponse()));
    useAuthStore.setState({ session: { status: 'initializing' } });
    const pending = deferred<unknown>();
    vi.spyOn(api, 'request').mockReturnValue(pending.promise);
    const restoring = new AuthService(api, 42).initialize();
    expireSession();
    pending.resolve(loginResponse());
    await restoring;
    expect(useAuthStore.getState().session.status).toBe('anonymous');
    expect(getAccessToken()).toBeNull();
  });
  it('inicialización idempotente sin red ni recuperación local', () => {
    const request = vi.spyOn(api, 'request');
    const service = new AuthService(api, 42);
    service.initialize();
    service.initialize();
    expect(useAuthStore.getState().session).toEqual({
      status: 'anonymous',
      reason: 'initial',
    });
    expect(request).not.toHaveBeenCalled();
  });
  it('rechaza configuración inválida sin request', async () => {
    const request = vi.spyOn(api, 'request');
    await expect(
      new AuthService(api, 0, 'Configuración pendiente').login(login),
    ).rejects.toHaveProperty('kind', 'contract');
    expect(request).not.toHaveBeenCalled();
  });
  it('descarta tokens de la respuesta antes de poblar el store', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(loginResponse());
    const service = new AuthService(api, 42);
    await service.login(login);
    service.initialize();
    expect(useAuthStore.getState().session.status).toBe('authenticated');
    expect(useAuthStore.getState().session).not.toHaveProperty(
      'user.accessToken',
    );
    expect(useAuthStore.getState().session).not.toHaveProperty(
      'user.refreshToken',
    );
  });
  it.each([
    { userId: 'wrong' },
    { expiresAt: 'not-a-date' },
    { requiresPasswordChange: null },
  ])('falla cerrado ante respuesta incompatible %o', async (override) => {
    vi.spyOn(api, 'request').mockResolvedValue({
      ...loginResponse(),
      ...override,
    });
    await expect(new AuthService(api, 42).login(login)).rejects.toHaveProperty(
      'kind',
      'contract',
    );
    expect(useAuthStore.getState().session.status).toBe('initializing');
  });
  it('rechaza sesión recibida ya vencida', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(
      loginResponse({ expiresAt: new Date(0).toISOString() }),
    );
    await expect(new AuthService(api, 42).login(login)).rejects.toHaveProperty(
      'kind',
      'authentication',
    );
  });
  it('evita dos mutaciones de cookies simultáneas', async () => {
    const pending = deferred<unknown>();
    const request = vi.spyOn(api, 'request').mockReturnValue(pending.promise);
    const service = new AuthService(api, 42);
    const first = service.login(login);
    await expect(service.login(login)).rejects.toHaveProperty(
      'kind',
      'conflict',
    );
    pending.resolve(loginResponse());
    await first;
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('una respuesta atrasada no revive una sesión invalidada', async () => {
    const pending = deferred<unknown>();
    vi.spyOn(api, 'request').mockReturnValue(pending.promise);
    const request = new AuthService(api, 42).login(login);
    expireSession();
    pending.resolve(loginResponse());
    await expect(request).rejects.toHaveProperty('kind', 'cancelled');
    expect(useAuthStore.getState().session.status).toBe('anonymous');
  });
  it('cambio exitoso conserva vencimiento y FirstLogin real, desactiva el bloqueo', async () => {
    const response = loginResponse({
      firstLogin: true,
      requiresPasswordChange: true,
    });
    const original = loginSessionSchema.parse(response);
    useAuthStore.getState().accept(original, response);
    vi.spyOn(api, 'request').mockResolvedValue(changedUser);
    await new AuthService(api, 42).changePassword(fields);
    expect(useAuthStore.getState().session).toEqual({
      status: 'authenticated',
      user: { ...original, requiresPasswordChange: false },
    });
  });
  it('permite validaciones UX sin importar la complejidad inventada del onboarding', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'x',
        newPassword: 'y',
        confirmPassword: 'y',
      }).success,
    ).toBe(true);
  });
  it.each(['changePassword', 'logout'] as const)(
    'no realiza %s sin sesión',
    async (method) => {
      const request = vi.spyOn(api, 'request');
      const service = new AuthService(api, 42);
      await expect(
        method === 'logout' ? service.logout() : service.changePassword(fields),
      ).rejects.toHaveProperty('kind', 'authentication');
      expect(request).not.toHaveBeenCalled();
    },
  );
  it('no autoriza acceso si la sesión vence durante el cambio', async () => {
    const response = loginResponse();
    useAuthStore
      .getState()
      .accept(loginSessionSchema.parse(response), response);
    const pending = deferred<unknown>();
    vi.spyOn(api, 'request').mockReturnValue(pending.promise);
    const request = new AuthService(api, 42).changePassword(fields);
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 1000000);
    pending.resolve(changedUser);
    await expect(request).rejects.toHaveProperty('kind', 'authentication');
    expect(useAuthStore.getState().session.status).toBe('anonymous');
  });
  it('passwordChanged no crea una sesión anónima', () => {
    useAuthStore.getState().clear('initial');
    useAuthStore.getState().passwordChanged();
    expect(useAuthStore.getState().session.status).toBe('anonymous');
  });
});
