import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SindicatosPage } from './SindicatosPage';
import { sindicatoService } from '../services/sindicatoService';
import { initialFields, toWrite } from '../schemas/sindicatoSchema';
import { ApiError } from '@/services/http/ApiError';
import { deferred } from '@/test/fixtures';
const access = vi.hoisted(() => ({ write: true, read: true, pending: false }));
vi.mock('@/features/auth/hooks/usePermissions', () => ({
  usePermissions: () => ({
    isPending: access.pending,
    isError: false,
    can: (p: string) => (p === 'sindicatos:read' ? access.read : access.write),
  }),
}));
vi.mock('../services/sindicatoService', () => ({
  sindicatoService: {
    list: vi.fn(),
    detail: vi.fn(),
    provincias: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
const row = {
  ...toWrite(initialFields()),
  id: 7,
  nombre: 'Comercio',
  provinciaNombre: null,
};
const show = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const close = Object.getOwnPropertyDescriptor(
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
    ['showModal', show],
    ['close', close],
  ] as const)
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
});
beforeEach(() => {
  vi.resetAllMocks();
  access.read = true;
  access.write = true;
  access.pending = false;
  vi.mocked(sindicatoService.list).mockResolvedValue({
    items: [row],
    page: 1,
    pageSize: 25,
    total: 30,
  });
  vi.mocked(sindicatoService.detail).mockResolvedValue(row);
  vi.mocked(sindicatoService.provincias).mockResolvedValue([]);
  vi.mocked(sindicatoService.create).mockResolvedValue(row);
  vi.mocked(sindicatoService.update).mockResolvedValue(row);
});
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <SindicatosPage />
    </QueryClientProvider>,
  );
}
it('muestra skeleton de permisos sin acciones interactivas', () => {
  access.pending = true;
  access.read = false;
  const { container } = mount();
  expect(screen.getByRole('status')).toHaveTextContent('Cargando permisos…');
  expect(container.querySelectorAll('.skeleton-grid-row')).toHaveLength(5);
  expect(
    screen.queryByRole('button', { name: 'Nuevo' }),
  ).not.toBeInTheDocument();
  expect(sindicatoService.list).not.toHaveBeenCalled();
});
it('muestra filas skeleton hasta recibir el listado', async () => {
  const pending = deferred<{
    items: (typeof row)[];
    total: number;
    page: number;
    pageSize: number;
  }>();
  vi.mocked(sindicatoService.list).mockReturnValue(pending.promise);
  const { container } = mount();
  expect(container.querySelectorAll('.skeleton-grid-row')).toHaveLength(5);
  pending.resolve({ items: [row], total: 1, page: 1, pageSize: 25 });
  await screen.findByText('Comercio');
  expect(container.querySelector('.skeleton-grid-row')).toBeNull();
});
it('carga provincias con skeleton de alta, bloquea Guardar y permite cancelar', async () => {
  const pending = deferred<never>();
  vi.mocked(sindicatoService.provincias).mockReturnValue(pending.promise);
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  const dialog = screen.getByRole('dialog');
  expect(
    dialog.querySelectorAll('.sindicato-form-skeleton .sindicato-entry'),
  ).toHaveLength(13);
  expect(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  ).toBeDisabled();
  expect(dialog.querySelector('input,select')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('reemplaza el skeleton por error y ofrece reintentar datos', async () => {
  vi.mocked(sindicatoService.provincias).mockRejectedValue(
    new ApiError('network', 'Sin conexión'),
  );
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  await screen.findByText('Sin conexión');
  expect(
    screen.getByRole('dialog').querySelector('.sindicato-form-skeleton'),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Reintentar datos' }),
  ).toBeInTheDocument();
});
it('al reabrir edición espera detalle actualizado y no reutiliza el borrador anterior', async () => {
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(await screen.findByLabelText('Nombre')).toHaveValue('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  const pending = deferred<typeof row>();
  vi.mocked(sindicatoService.detail).mockReturnValueOnce(pending.promise);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(screen.getByText('Cargando datos…')).toBeInTheDocument();
  expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
  pending.resolve({ ...row, nombre: 'Actualizado por otro usuario' });
  expect(await screen.findByLabelText('Nombre')).toHaveValue(
    'Actualizado por otro usuario',
  );
});
it('carga 25, pagina en servidor y deshabilita controles sin soporte', async () => {
  mount();
  await screen.findByText('Comercio');
  expect(sindicatoService.list).toHaveBeenCalledWith(
    1,
    25,
    expect.any(AbortSignal),
  );
  expect(screen.getByRole('searchbox')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Filtros' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
  await waitFor(() =>
    expect(sindicatoService.list).toHaveBeenCalledWith(
      2,
      25,
      expect.any(AbortSignal),
    ),
  );
});
it('reutiliza formulario para alta y edición, invalida y cancela', async () => {
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  await screen.findByLabelText('Nombre');
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'Nuevo' },
  });
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  );
  await waitFor(() =>
    expect(sindicatoService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Nuevo' }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(vi.mocked(sindicatoService.list).mock.calls.length).toBeGreaterThan(1);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(await screen.findByLabelText('Nombre')).toHaveValue('Comercio');
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  );
  await waitFor(() =>
    expect(sindicatoService.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ nombre: 'Comercio' }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('confirma eliminación y muestra conflictos sin cerrar', async () => {
  vi.mocked(sindicatoService.delete).mockRejectedValue(
    new ApiError('conflict', 'Conflicto de relaciones.'),
  );
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
  expect(sindicatoService.delete).not.toHaveBeenCalled();
  const buttons = screen.getAllByRole('button', { name: 'Eliminar' });
  await userEvent.click(buttons[buttons.length - 1]!);
  await screen.findByText('Conflicto de relaciones.');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
it('presenta error y reintento, luego vacío', async () => {
  vi.mocked(sindicatoService.list)
    .mockRejectedValueOnce(new ApiError('network', 'Sin conexión'))
    .mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
  mount();
  await screen.findByText('Sin conexión');
  await userEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
  await screen.findByText('No hay sindicatos para mostrar.');
});
it('permite consultar el detalle desde Ver sin permiso de escritura', async () => {
  access.write = false;
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Ver' }));
  expect(screen.getByLabelText('Nombre')).toHaveValue('Comercio');
  expect(screen.getByLabelText('Nombre')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Provincia')).toHaveAttribute('readonly');
  await userEvent.type(screen.getByLabelText('Nombre'), 'No cambiar');
  expect(screen.getByLabelText('Nombre')).toHaveValue('Comercio');
  fireEvent.submit(screen.getByLabelText('Nombre').closest('form')!);
  expect(sindicatoService.update).not.toHaveBeenCalled();
  expect(sindicatoService.create).not.toHaveBeenCalled();
  expect(
    screen.getByRole('dialog', { name: 'Ver sindicato' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Guardar y cerrar' }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
});
it('respeta lectura y acciones según permisos', async () => {
  access.write = false;
  const view = mount();
  await screen.findByText('Comercio');
  expect(
    screen.queryByRole('button', { name: 'Nuevo' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Editar' }),
  ).not.toBeInTheDocument();
  view.unmount();
  vi.mocked(sindicatoService.list).mockClear();
  access.read = false;
  mount();
  expect(
    screen.getByText('No tenés permiso para consultar sindicatos.'),
  ).toBeInTheDocument();
  expect(sindicatoService.list).not.toHaveBeenCalled();
});

it('Guardar mantiene el registro creado y el siguiente guardado actualiza su ID', async () => {
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  await screen.findByLabelText('Nombre');
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'Creado' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByRole('dialog', { name: 'Editar sindicato' });
  expect(await screen.findByLabelText('Nombre')).toHaveValue('Comercio');
  expect(sindicatoService.create).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'Actualizado' },
  });
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  );
  await waitFor(() =>
    expect(sindicatoService.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ nombre: 'Actualizado' }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(sindicatoService.create).toHaveBeenCalledTimes(1);
});
it('Guardar y nuevo reinicia campos; Deshacer descarta cambios en alta y recarga edición', async () => {
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  await screen.findByLabelText('Nombre');
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'Borrador' },
  });
  vi.mocked(sindicatoService.detail).mockResolvedValue({
    ...row,
    nombre: 'Servidor',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Nombre')).toHaveValue('Servidor'),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y nuevo' }),
  );
  await screen.findByRole('dialog', { name: 'Nuevo sindicato' });
  expect(screen.getByLabelText('Nombre')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'Descartar' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
  expect(screen.getByLabelText('Nombre')).toHaveValue('');
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  );
  await waitFor(() =>
    expect(sindicatoService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: null }),
    ),
  );
});
it('bloquea acciones durante envío y conserva el borrador si falla', async () => {
  const pending = deferred<typeof row>();
  vi.mocked(sindicatoService.create).mockReturnValue(pending.promise);
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  await screen.findByLabelText('Nombre');
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'Conservar' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  expect(screen.getByLabelText('Nombre')).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Guardar y nuevo' }),
  ).toBeDisabled();
  pending.reject(
    new ApiError('validation', 'Revisá los datos.', 400, {
      Nombre: 'Valor rechazado',
    }),
  );
  await screen.findByText('Valor rechazado');
  expect(screen.getByLabelText('Nombre')).toHaveValue('Conservar');
  expect(screen.getByLabelText('Nombre')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
});
