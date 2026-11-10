import { config } from '@/lib/config';
import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { useUiStore } from '@/stores/uiStore';
import { useTenantContextStore } from '@/stores/tenantContextStore';
import {
  loginSessionSchema,
  loginResponseSchema,
  refreshResponseSchema,
  restoredIdentitySchema,
  type LoginFields,
} from '../schemas/authSchemas';
import { useAuthStore } from '../stores/authStore';
import { readSessionContext } from './sessionContext';
import {
  captureServerSessionTiming,
  remainingSessionTime,
} from './sessionClock';
import { getSessionRemainingMs } from './sessionTokens';
import {
  canRequestWithSession,
  canResumeSession,
  sessionCredentials,
} from './sessionExpiry';
import type {
  ChangePasswordRequest,
  LoginResponse,
  UserDto,
} from '../types/auth';

export function expireSession() {
  useAuthStore.getState().clear('expired');
  useUiStore.getState().reset();
}

// Only an expired access token inside the resume window is recoverable.
export const sessionHttpHooks = {
  dataTenant: () => useTenantContextStore.getState().tenant?.id ?? null,
  dataRevision: () => useTenantContextStore.getState().revision,
  revision: () => useAuthStore.getState().revision,
  credentials: sessionCredentials,
  canRequest: canRequestWithSession,
  expire: () => {
    if (!canResumeSession()) expireSession();
  },
};

export const apiClient = new ApiClient(config.baseURL, sessionHttpHooks);

export class AuthService {
  private busy = false;
  private initialization: Promise<void> | null = null;
  private renewal: Promise<void> | null = null;
  constructor(
    private readonly api: ApiClient,
    private readonly applicationId: number,
    private readonly configurationError: string | null = null,
  ) {}

  private async operation(action: (revision: number) => Promise<void>) {
    if (this.busy)
      throw new ApiError(
        'conflict',
        'Esperá a que termine la operación actual.',
      );
    this.busy = true;
    const revision = useAuthStore.getState().revision;
    const run = async () => {
      this.assertCurrent(revision);
      await action(revision);
    };
    try {
      // HttpOnly cookies are shared across tabs. Serialize their mutations on
      // the same origin so refresh-token rotation cannot consume the same pair.
      if (globalThis.navigator?.locks)
        await navigator.locks.request('liquidar-security-session', run);
      else await run();
    } finally {
      this.busy = false;
    }
  }

  private assertCurrent(revision: number) {
    if (revision !== useAuthStore.getState().revision)
      throw new ApiError(
        'cancelled',
        'La sesión cambió. Iniciá sesión nuevamente.',
      );
  }

  private assertSession() {
    const session = useAuthStore.getState().session;
    if (!('user' in session) || (getSessionRemainingMs() ?? 0) <= 0) {
      if (!canResumeSession()) expireSession();
      throw new ApiError(
        'authentication',
        'Tu sesión venció. Iniciá sesión nuevamente.',
      );
    }
  }

  initialize() {
    if (this.initialization) return this.initialization;
    if (
      useAuthStore.getState().session.status !== 'initializing' &&
      useAuthStore.getState().session.status !== 'restore-error'
    )
      return Promise.resolve();
    const context = readSessionContext();
    if (!context) {
      useAuthStore.getState().clear('initial');
      return Promise.resolve();
    }
    useAuthStore.setState({ session: { status: 'initializing' } });
    this.initialization = this.operation(async (revision) => {
      try {
        if (this.configurationError)
          throw new ApiError('contract', this.configurationError);
        const started = performance.now();
        let serverDate: string | null = null;
        const response = await this.api.request<unknown>(
          'POST',
          '/auth/refresh',
          undefined,
          {
            onServerDate: (value) => {
              serverDate = value;
            },
          },
        );
        this.assertCurrent(revision);
        const parsed = refreshResponseSchema.safeParse(response);
        if (!parsed.success)
          throw new ApiError('contract', 'No pudimos restaurar la sesión.');
        const timing = captureServerSessionTiming(
          parsed.data.accessTokenRemainingMilliseconds,
          parsed.data.accessTokenExpiry,
          serverDate,
          started,
        );
        if (remainingSessionTime(timing) <= 0)
          throw new ApiError(
            'authentication',
            'La sesión recibida ya venció.',
            401,
          );
        const identity = restoredIdentitySchema.safeParse(
          await this.api.request<unknown>('GET', '/users/me', undefined, {
            authenticated: true,
          }),
        );
        this.assertCurrent(revision);
        if (!identity.success)
          throw new ApiError('contract', 'No pudimos validar la sesión.');
        if (remainingSessionTime(timing) <= 0)
          throw new ApiError(
            'authentication',
            'La sesión recibida ya venció.',
            401,
          );
        if (
          identity.data.user.id !== context.userId ||
          identity.data.actor.userId !== context.userId ||
          identity.data.actor.applicationId !== this.applicationId
        )
          throw new ApiError(
            'authentication',
            'La sesión cambió. Iniciá sesión nuevamente.',
            401,
          );
        useAuthStore.getState().accept(
          {
            ...context,
            userName: identity.data.user.userName,
            isSuperAdmin: identity.data.actor.isSuperAdmin,
            expiresAt: parsed.data.accessTokenExpiry,
          },
          parsed.data,
          timing,
        );
      } catch (error) {
        if (revision !== useAuthStore.getState().revision) return;
        if (error instanceof ApiError && error.status === 401) {
          expireSession();
        } else {
          useAuthStore.setState({ session: { status: 'restore-error' } });
        }
      }
    }).finally(() => {
      this.initialization = null;
    });
    return this.initialization;
  }

  login(fields: LoginFields) {
    return this.operation(async (revision) => {
      if (this.configurationError)
        throw new ApiError('contract', this.configurationError);
      const started = performance.now();
      let serverDate: string | null = null;
      const response = await this.api.request<LoginResponse>(
        'POST',
        '/auth/login',
        { ...fields, applicationId: this.applicationId },
        {
          onServerDate: (value) => {
            serverDate = value;
          },
          parseError: (error, body) => {
            if (
              error.status !== 401 ||
              !body ||
              typeof body !== 'object' ||
              !('detail' in body) ||
              typeof body.detail !== 'string'
            )
              return error;
            const detail = body.detail;
            const messages = new Set([
              'Credenciales inválidas.',
              'Usuario inactivo.',
              'Aplicación no encontrada.',
              'El usuario no tiene un rol asignado para esta aplicación.',
              'Tenant inexistente o inactivo.',
              'La aplicación no está habilitada para este tenant.',
              'La aplicación fue desactivada para este Cliente.',
              'Trial sin fecha de vencimiento configurada.',
              'El período de prueba finalizó.',
              'La licencia vitalicia fue revocada.',
              'No hay datos de facturación configurados para esta suscripción.',
              'La suscripción fue suspendida manualmente.',
              'Pago vencido, fuera del período de gracia.',
              'El tenant no tiene acceso a esta aplicación.',
            ]);
            const pendingStart =
              /^El cliente podrá acceder a partir del \d{2}\/\d{2}\/\d{4} a las 00:00 \(hora de Argentina\)\.$/.test(
                detail,
              );
            return messages.has(detail) || pendingStart
              ? new ApiError(
                  error.kind,
                  detail,
                  error.status,
                  error.fieldErrors,
                )
              : error;
          },
        },
      );
      this.assertCurrent(revision);
      const parsed = loginResponseSchema.safeParse(response);
      if (!parsed.success)
        throw new ApiError(
          'contract',
          'No pudimos validar la respuesta del servicio. Contactá al administrador.',
        );
      const timing = captureServerSessionTiming(
        parsed.data.accessTokenRemainingMilliseconds,
        parsed.data.expiresAt,
        serverDate,
        started,
      );
      if (remainingSessionTime(timing) <= 0)
        throw new ApiError(
          'authentication',
          'La sesión recibida ya venció. Probá de nuevo.',
        );
      useAuthStore.getState().accept(
        loginSessionSchema.parse(parsed.data),
        {
          accessToken: parsed.data.accessToken,
          refreshToken: parsed.data.refreshToken,
        },
        timing,
      );
    });
  }

  resume() {
    if (this.renewal) return this.renewal;
    this.renewal = this.operation(async (revision) => {
      const session = useAuthStore.getState().session;
      if (!('user' in session) || !canResumeSession()) {
        expireSession();
        throw new ApiError(
          'authentication',
          'Tu sesión venció. Iniciá sesión nuevamente.',
          401,
        );
      }
      const originalCredentials = sessionCredentials();
      const assertResumable = () => {
        this.assertCurrent(revision);
        if (sessionCredentials() !== originalCredentials)
          throw new ApiError('cancelled', 'La sesión cambió.');
        if (!canResumeSession()) {
          expireSession();
          throw new ApiError(
            'authentication',
            'Tu sesión venció. Iniciá sesión nuevamente.',
            401,
          );
        }
      };
      try {
        if (this.configurationError)
          throw new ApiError('contract', this.configurationError);
        const started = performance.now();
        let serverDate: string | null = null;
        const response = await this.api.request<unknown>(
          'POST',
          '/auth/refresh',
          undefined,
          {
            onServerDate: (value) => {
              serverDate = value;
            },
          },
        );
        assertResumable();
        const tokens = refreshResponseSchema.safeParse(response);
        if (!tokens.success)
          throw new ApiError(
            'contract',
            'No pudimos validar la renovación. Probá de nuevo.',
          );
        const timing = captureServerSessionTiming(
          tokens.data.accessTokenRemainingMilliseconds,
          tokens.data.accessTokenExpiry,
          serverDate,
          started,
        );
        if (remainingSessionTime(timing) <= 0)
          throw new ApiError(
            'authentication',
            'La sesión recibida ya venció.',
            401,
          );
        // Fresh HttpOnly cookies authenticate this request before committing UI state.
        // Handle 401 here: the previous access token is intentionally expired.
        const identity = restoredIdentitySchema.safeParse(
          await this.api.request<unknown>('GET', '/users/me'),
        );
        assertResumable();
        if (!identity.success)
          throw new ApiError(
            'contract',
            'No pudimos validar la sesión. Probá de nuevo.',
          );
        if (
          identity.data.user.id !== session.user.userId ||
          identity.data.actor.userId !== session.user.userId ||
          identity.data.actor.applicationId !== this.applicationId
        )
          throw new ApiError(
            'authentication',
            'La sesión cambió. Iniciá sesión nuevamente.',
            401,
          );
        if (remainingSessionTime(timing) <= 0)
          throw new ApiError(
            'authentication',
            'La sesión recibida ya venció.',
            401,
          );
        useAuthStore.getState().renew(
          {
            ...session.user,
            userName: identity.data.user.userName,
            isSuperAdmin: identity.data.actor.isSuperAdmin,
            expiresAt: tokens.data.accessTokenExpiry,
          },
          tokens.data,
          timing,
        );
      } catch (error) {
        if (
          revision === useAuthStore.getState().revision &&
          error instanceof ApiError &&
          error.status === 401
        )
          expireSession();
        throw error;
      }
    }).finally(() => {
      this.renewal = null;
    });
    return this.renewal;
  }

  changePassword(fields: ChangePasswordRequest) {
    return this.operation(async (revision) => {
      this.assertSession();
      await this.api.request<UserDto>('PUT', '/users/', fields, {
        authenticated: true,
      });
      this.assertCurrent(revision);
      this.assertSession();
      // Security clears RequiresPasswordChange on successful PUT. No new login/token is needed.
      useAuthStore.getState().passwordChanged();
    });
  }

  logout() {
    return this.operation(async (revision) => {
      this.assertSession();
      await this.api.request('POST', '/auth/revoke', undefined, {
        authenticated: true,
      });
      this.assertCurrent(revision);
      useAuthStore.getState().clear('logout');
      useUiStore.getState().reset();
    });
  }
}

export const authService = new AuthService(
  apiClient,
  config.applicationId,
  config.error,
);
