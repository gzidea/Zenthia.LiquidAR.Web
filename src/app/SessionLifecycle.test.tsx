import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { authService } from '@/features/auth/services/authService';
import { loginSessionSchema } from '@/features/auth/schemas/authSchemas';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { loginResponse, deferred } from '@/test/fixtures';
import { ApiError } from '@/services/http/ApiError';
import { SessionLifecycle } from './SessionLifecycle';

const originalShow = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
);
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open');
    },
  });
});
afterAll(() => {
  for (const [key, descriptor] of [
    ['showModal', originalShow],
    ['close', originalClose],
  ] as const) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});
beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers();
  vi.spyOn(authService, 'initialize').mockResolvedValue();
  const response = loginResponse({
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
  });
  useAuthStore.getState().accept(loginSessionSchema.parse(response), response);
});
afterEach(() => vi.useRealTimers());

describe('Diálogo al vencer el access token', () => {
  it('aparece sin actividad, cuenta 30 segundos y cierra al llegar al límite', () => {
    render(<SessionLifecycle />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10_000));
    expect(
      screen.getByRole('dialog', { name: 'Tu sesión está por cerrarse' }),
    ).toBeVisible();
    expect(screen.getByRole('timer')).toHaveTextContent('30 segundos');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer')).toHaveTextContent('29 segundos');
    act(() => vi.advanceTimersByTime(29_000));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useAuthStore.getState().session.status).toBe('anonymous');
  });

  it.each(['focus', 'visibilitychange'])(
    'los saltos de hora no cambian el plazo al volver mediante %s',
    (event) => {
      render(<SessionLifecycle />);
      vi.setSystemTime(Date.now() + 20_000);
      act(() =>
        (event === 'focus' ? window : document).dispatchEvent(new Event(event)),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(20_000));
      expect(screen.getByRole('timer')).toHaveTextContent('20 segundos');
      vi.setSystemTime(Date.now() - 86_400_000);
      act(() =>
        (event === 'focus' ? window : document).dispatchEvent(new Event(event)),
      );
      expect(screen.getByRole('timer')).toHaveTextContent('20 segundos');
      act(() => vi.advanceTimersByTime(20_000));
      expect(useAuthStore.getState().session.status).toBe('anonymous');
    },
  );

  it('no permite descartar el aviso y bloquea clics repetidos durante el refresh', async () => {
    const pending = deferred<void>();
    const resume = vi
      .spyOn(authService, 'resume')
      .mockReturnValue(pending.promise);
    render(<SessionLifecycle />);
    act(() => vi.advanceTimersByTime(10_000));
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog).toBeVisible();
    const button = screen.getByRole('button', { name: 'Extender la sesión' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName('Extendiendo…');
    expect(screen.queryByText('Extendiendo la sesión…')).not.toBeInTheDocument();
    expect(resume).toHaveBeenCalledTimes(1);
    await act(async () =>
      pending.reject(new ApiError('network', 'Sin conexión.')),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión.');
    expect(button).toBeEnabled();
    expect(screen.getByRole('timer')).toHaveTextContent('30 segundos');
  });

  it('no modifica la sesión después de desmontar', () => {
    const view = render(<SessionLifecycle />);
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(60_000);
      window.dispatchEvent(new Event('focus'));
    });
    expect(useAuthStore.getState().session.status).toBe('authenticated');
  });

  it('Cerrar sesión termina inmediatamente sin esperar los 30 segundos', () => {
    render(<SessionLifecycle />);
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole('timer')).toHaveTextContent('30 segundos');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(useAuthStore.getState().session).toEqual({
      status: 'anonymous',
      reason: 'expired',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('permite cerrar aunque la renovación esté esperando al servidor', async () => {
    const pending = deferred<void>();
    vi.spyOn(authService, 'resume').mockReturnValue(pending.promise);
    render(<SessionLifecycle />);
    act(() => vi.advanceTimersByTime(10_000));
    fireEvent.click(screen.getByRole('button', { name: 'Extender la sesión' }));
    const close = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(close).toBeEnabled();
    fireEvent.click(close);
    await act(async () => pending.resolve());
    expect(useAuthStore.getState().session.status).toBe('anonymous');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
