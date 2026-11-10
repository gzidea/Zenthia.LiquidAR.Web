import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '@/lib/config';
import { ApiError } from '@/services/http/ApiError';
import { apiClient } from '@/features/auth/services/authService';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { loginSessionSchema } from '@/features/auth/schemas/authSchemas';
import { useUiStore } from '@/stores/uiStore';
import { changedUser, deferred, loginResponse } from '@/test/fixtures';
import { AppRoutes } from './AppRoutes';
// Authentication tests isolate the separately tested permission query.
vi.mock('@/layouts/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('@/features/auth/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => false, isError: false }),
}));
vi.mock('@/features/liquidaciones/hooks', () => ({
  useLiquidacionesCapacidades: () => ({
    data: { leer: false, generar: false, corregirNovedades: false },
    isError: false,
  }),
}));

vi.mock('@/lib/config', () => ({
  config: { applicationId: 42, baseURL: '/api', error: null },
}));

function mount(path = '/login') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </StrictMode>,
  );
}
function authenticate(mandatory = false, firstLogin = false) {
  const response = loginResponse({
    requiresPasswordChange: mandatory,
    firstLogin,
  });
  useAuthStore.getState().accept(loginSessionSchema.parse(response), response);
}
async function fillLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Usuario o email'), 'ana');
  await user.type(
    screen.getByLabelText('Contraseña', { exact: true }),
    'Temporal123',
  );
  await user.click(screen.getByRole('button', { name: 'Ingresar →' }));
}
async function fillPassword(current = 'Contraseña actual') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(current), 'Temporal123');
  await user.type(screen.getByLabelText('Contraseña nueva'), 'Nueva123');
  await user.type(screen.getByLabelText('Confirmar contraseña'), 'Nueva123');
  await user.click(screen.getByRole('button', { name: 'Guardar y entrar →' }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  config.error = null;
  useAuthStore.setState({ session: { status: 'initializing' }, revision: 0 });
  useUiStore.getState().reset();
});

describe('Login y rutas', () => {
  it.each(['/login', '/app', '/first-login', '/change-password', '/otra'])(
    'muestra login para anónimo en %s sin consultar /me ni otro endpoint',
    async (path) => {
      const request = vi.spyOn(apiClient, 'request');
      mount(path);
      expect(
        await screen.findByRole('heading', { name: 'Ingresá a tu espacio' }),
      ).toBeVisible();
      expect(request).not.toHaveBeenCalled();
      expect(
        screen.getByLabelText('Contraseña', { exact: true }),
      ).toHaveAttribute('type', 'password');
    },
  );
  it('valida campos, asocia errores y no llama a Security', async () => {
    const request = vi.spyOn(apiClient, 'request');
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar →' }));
    expect(
      await screen.findByText('Ingresá tu usuario o email.'),
    ).toBeVisible();
    expect(
      screen.getByLabelText('Usuario o email'),
    ).toHaveAccessibleDescription('Ingresá tu usuario o email.');
    expect(
      screen.getByLabelText('Contraseña', { exact: true }),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(request).not.toHaveBeenCalled();
  });
  it('muestra loading y errores, limpia contraseña y permite reintentar', async () => {
    const pending = deferred<never>();
    const request = vi
      .spyOn(apiClient, 'request')
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(loginResponse());
    mount();
    await fillLogin();
    expect(screen.getByRole('button', { name: 'Verificando…' })).toBeDisabled();
    expect(screen.getByLabelText('Usuario o email')).toBeDisabled();
    await act(async () =>
      pending.reject(
        new ApiError('authentication', 'Credenciales inválidas.', 401),
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credenciales inválidas.',
    );
    expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveValue(
      '',
    );
    await userEvent.type(
      screen.getByLabelText('Contraseña', { exact: true }),
      'Correcta',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar →' }));
    expect(
      await screen.findByRole('heading', { name: 'Hola, ana.' }),
    ).toBeVisible();
    expect(request).toHaveBeenLastCalledWith(
      'POST',
      '/auth/login',
      {
        userName: 'ana',
        password: 'Correcta',
        applicationId: 42,
      },
      { onServerDate: expect.any(Function) },
    );
  });
  it('login común entra al shell sin retener los tokens recibidos', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue(loginResponse());
    mount();
    await fillLogin();
    expect(
      await screen.findByRole('heading', { name: 'Hola, ana.' }),
    ).toBeVisible();
    expect(screen.getByRole('navigation')).toHaveAccessibleName(
      'Navegación principal',
    );
    expect(JSON.stringify(useAuthStore.getState())).not.toContain('test-only');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
    const saved = JSON.parse(
      sessionStorage.getItem('liquidar.session-context')!,
    );
    expect(saved).not.toHaveProperty('accessToken');
    expect(saved).not.toHaveProperty('refreshToken');
    expect(saved).not.toHaveProperty('password');
  });
  it('la configuración pendiente bloquea el formulario sin enviar un ApplicationId inventado', () => {
    config.error =
      'El acceso todavía no está configurado. Contactá al administrador.';
    const request = vi.spyOn(apiClient, 'request');
    mount();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'El acceso todavía no está configurado',
    );
    expect(screen.getByRole('button', { name: 'Ingresar →' })).toBeDisabled();
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['/login', '/first-login'])(
    'usuario autenticado evita volver a %s',
    async (path) => {
      authenticate();
      mount(path);
      expect(
        await screen.findByRole('heading', { name: 'Hola, ana.' }),
      ).toBeVisible();
    },
  );
  it('un firstLogin histórico sin cambio requerido no crea un bucle', async () => {
    authenticate(false, true);
    mount('/login');
    expect(
      await screen.findByRole('heading', { name: 'Hola, ana.' }),
    ).toBeVisible();
  });
  it('muestra página inexistente dentro del shell y permite volver', async () => {
    authenticate();
    mount('/app/no-existe');
    expect(
      screen.getByRole('heading', { name: 'Página no encontrada' }),
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole('link', { name: 'Volver al inicio' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Hola, ana.' }),
    ).toBeVisible();
  });
});

describe('Primer ingreso y cambio de clave', () => {
  it('detecta primer ingreso desde el login real y muestra bienvenida', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue(
      loginResponse({ firstLogin: true, requiresPasswordChange: true }),
    );
    mount();
    await fillLogin();
    expect(
      await screen.findByRole('heading', { name: 'Te damos la bienvenida' }),
    ).toBeVisible();
  });
  it.each(['/app', '/app/modulo', '/login'])(
    'bloquea %s durante el primer ingreso',
    async (path) => {
      authenticate(true, true);
      mount(path);
      expect(
        await screen.findByRole('heading', { name: 'Te damos la bienvenida' }),
      ).toBeVisible();
      expect(
        screen.queryByRole('navigation', { name: 'Navegación principal' }),
      ).not.toBeInTheDocument();
    },
  );
  it('cambio requerido sin primer ingreso va directamente al formulario', async () => {
    authenticate(true, false);
    mount('/first-login');
    expect(
      await screen.findByRole('heading', { name: 'Elegí tu contraseña' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Contraseña actual')).toBeVisible();
  });
  it('valida campos y coincidencia antes de enviar', async () => {
    const request = vi.spyOn(apiClient, 'request');
    authenticate(true, true);
    mount('/change-password');
    await userEvent.click(
      screen.getByRole('button', { name: 'Guardar y entrar →' }),
    );
    expect(
      await screen.findByText('Ingresá tu contraseña actual.'),
    ).toBeVisible();
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'a');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'b');
    await userEvent.click(
      screen.getByRole('button', { name: 'Guardar y entrar →' }),
    );
    expect(
      await screen.findByText('Las contraseñas no coinciden.'),
    ).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });
  it('completa bienvenida, cambio y acceso sin un segundo login', async () => {
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValue(changedUser);
    authenticate(true, true);
    mount('/first-login');
    await userEvent.click(
      screen.getByRole('link', { name: 'Elegir mi contraseña →' }),
    );
    await fillPassword('Contraseña temporal');
    expect(
      await screen.findByRole('heading', { name: 'Hola, ana.' }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tu contraseña se actualizó correctamente.',
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'PUT',
      '/users/',
      {
        currentPassword: 'Temporal123',
        newPassword: 'Nueva123',
        confirmPassword: 'Nueva123',
      },
      { authenticated: true },
    );
    expect(useAuthStore.getState().session.status).toBe('authenticated');
  });
  it('muestra loading y error de clave sin habilitar el acceso', async () => {
    const pending = deferred<never>();
    vi.spyOn(apiClient, 'request').mockReturnValue(pending.promise);
    authenticate(true);
    mount('/change-password');
    await fillPassword();
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Cerrar sesión' }),
    ).not.toBeInTheDocument();
    await act(async () =>
      pending.reject(
        new ApiError('authorization', 'Contraseña actual incorrecta.', 403),
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Contraseña actual incorrecta.',
    );
    expect(useAuthStore.getState().session.status).toBe('password-required');
    expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('');
  });
  it('cambio voluntario permite volver al inicio', async () => {
    authenticate();
    mount('/app');
    await userEvent.click(
      screen.getByRole('link', { name: 'Cambiar mi contraseña →' }),
    );
    expect(screen.getByLabelText('Contraseña actual')).toBeVisible();
    await userEvent.click(
      screen.getByRole('link', { name: 'Volver a la aplicación' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Hola, ana.' }),
    ).toBeVisible();
  });
});

describe('Sesión, logout y UI', () => {
  it('logout exitoso revoca en Security y limpia usuario y UI', async () => {
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValue({ message: 'Tokens revocados correctamente.' });
    authenticate();
    useUiStore.setState({ sidebarOpen: true });
    mount('/app');
    await userEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', {
        name: 'Cerrar sesión',
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Ingresá a tu espacio' }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cerraste sesión correctamente.',
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'POST',
      '/auth/revoke',
      undefined,
      { authenticated: true },
    );
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    expect(useAuthStore.getState().session).not.toHaveProperty('user');
  });
  it('logout fallido no finge eliminar cookies HttpOnly', async () => {
    const pending = deferred<never>();
    vi.spyOn(apiClient, 'request').mockReturnValue(pending.promise);
    authenticate();
    mount('/app');
    await userEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', {
        name: 'Cerrar sesión',
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Cerrando sesión…' }),
    ).toBeDisabled();
    await act(async () =>
      pending.reject(
        new ApiError(
          'network',
          'No pudimos conectar con el servidor. Probá de nuevo.',
        ),
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar',
    );
    expect(useAuthStore.getState().session.status).toBe('authenticated');
  });
  it('expira al recuperar el foco y no intenta refresh ni /me', async () => {
    const request = vi.spyOn(apiClient, 'request');
    authenticate();
    mount('/app');
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 1000000);
    act(() => window.dispatchEvent(new Event('focus')));
    expect(
      await screen.findByRole('heading', { name: 'Ingresá a tu espacio' }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión venció.');
    expect(request).not.toHaveBeenCalled();
  });
  it('expira por temporizador y limpia los listeners al desmontar', async () => {
    vi.useFakeTimers();
    try {
      authenticate();
      const view = mount('/app');
      act(() => vi.advanceTimersByTime(930001));
      expect(
        screen.getByRole('heading', { name: 'Ingresá a tu espacio' }),
      ).toBeVisible();
      view.unmount();
      const revision = useAuthStore.getState().revision;
      act(() => {
        vi.runOnlyPendingTimers();
        window.dispatchEvent(new Event('focus'));
      });
      expect(useAuthStore.getState().revision).toBe(revision);
    } finally {
      vi.useRealTimers();
    }
  });
  it('abre y cierra navegación con estado accesible', async () => {
    authenticate();
    mount('/app');
    const toggle = screen.getByRole('button', { name: 'Menú' });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('link', { name: 'Inicio' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() =>
      expect(document.title).toContain('Zenthia.LiquidAR.Web'),
    );
  });
});
