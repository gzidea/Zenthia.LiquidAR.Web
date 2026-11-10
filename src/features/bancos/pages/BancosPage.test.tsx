import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BancosPage } from './BancosPage';
import { bancoService } from '../services/bancoService';
import { initialFields, toWrite } from '../schemas/bancoSchema';
import { ApiError } from '@/services/http/ApiError';
import { BcraImportError } from '../services/bcraResult';
import { deferred } from '@/test/fixtures';
const access = vi.hoisted(() => ({
  write: true,
  read: true,
  pending: false,
  delete: true,
}));
vi.mock('@/features/auth/hooks/usePermissions', () => ({
  usePermissions: () => ({
    isPending: access.pending,
    isError: false,
    can: (p: string) =>
      ({
        'bancos:read': access.read,
        'bancos:write': access.write,
        'bancos:delete': access.delete,
      })[p] ?? false,
  }),
}));
vi.mock('../services/bancoService', () => ({
  bancoService: {
    list: vi.fn(),
    detail: vi.fn(),
    actualizarDesdeBcra: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
const row = {
  ...toWrite(initialFields()),
  id: 7,
  denominacion: 'Comercio',
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
  access.delete = true;
  vi.mocked(bancoService.list).mockResolvedValue({
    items: [row],
    page: 1,
    pageSize: 25,
    total: 30,
  });
  vi.mocked(bancoService.detail).mockResolvedValue(row);
  vi.mocked(bancoService.create).mockResolvedValue(row);
  vi.mocked(bancoService.update).mockResolvedValue(row);
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
      <BancosPage />
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
  expect(bancoService.list).not.toHaveBeenCalled();
});
it('muestra filas skeleton hasta recibir el listado', async () => {
  const pending = deferred<{
    items: (typeof row)[];
    total: number;
    page: number;
    pageSize: number;
  }>();
  vi.mocked(bancoService.list).mockReturnValue(pending.promise);
  const { container } = mount();
  expect(container.querySelectorAll('.skeleton-grid-row')).toHaveLength(5);
  pending.resolve({ items: [row], total: 1, page: 1, pageSize: 25 });
  await screen.findByText('Comercio');
  expect(container.querySelector('.skeleton-grid-row')).toBeNull();
});
it('carga detalle con skeleton de edicion, bloquea Guardar y permite cancelar', async () => {
  const pending = deferred<never>();
  vi.mocked(bancoService.detail).mockReturnValue(pending.promise);
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const dialog = screen.getByRole('dialog');
  expect(
    dialog.querySelectorAll('.banco-form-skeleton .banco-entry'),
  ).toHaveLength(3);
  expect(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  ).toBeDisabled();
  expect(dialog.querySelector('input,select')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('reemplaza el skeleton por error y ofrece reintentar datos', async () => {
  vi.mocked(bancoService.detail).mockRejectedValue(
    new ApiError('network', 'Sin conexión'),
  );
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  await screen.findByText('Sin conexión');
  expect(
    screen.getByRole('dialog').querySelector('.banco-form-skeleton'),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Reintentar datos' }),
  ).toBeInTheDocument();
});
it('al reabrir edición espera detalle actualizado y no reutiliza el borrador anterior', async () => {
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(await screen.findByLabelText('Denominación')).toHaveValue('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  const pending = deferred<typeof row>();
  vi.mocked(bancoService.detail).mockReturnValueOnce(pending.promise);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(screen.getByText('Cargando datos…')).toBeInTheDocument();
  expect(screen.queryByLabelText('Denominación')).not.toBeInTheDocument();
  pending.resolve({ ...row, denominacion: 'Actualizado por otro usuario' });
  expect(await screen.findByLabelText('Denominación')).toHaveValue(
    'Actualizado por otro usuario',
  );
});
it('carga 25, pagina en servidor y deshabilita controles sin soporte', async () => {
  mount();
  await screen.findByText('Comercio');
  expect(bancoService.list).toHaveBeenCalledWith(
    1,
    25,
    expect.any(AbortSignal),
  );
  expect(screen.getByRole('searchbox')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Filtros' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
  await waitFor(() =>
    expect(bancoService.list).toHaveBeenCalledWith(
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
  await screen.findByLabelText('Denominación');
  fireEvent.change(screen.getByLabelText('Denominación'), {
    target: { value: 'Nuevo' },
  });
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  );
  await waitFor(() =>
    expect(bancoService.create).toHaveBeenCalledWith(
      expect.objectContaining({ denominacion: 'Nuevo' }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(vi.mocked(bancoService.list).mock.calls.length).toBeGreaterThan(1);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(await screen.findByLabelText('Denominación')).toHaveValue('Comercio');
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  );
  await waitFor(() =>
    expect(bancoService.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ denominacion: 'Comercio' }),
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
  vi.mocked(bancoService.delete).mockRejectedValue(
    new ApiError('conflict', 'Conflicto de relaciones.'),
  );
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
  expect(bancoService.delete).not.toHaveBeenCalled();
  const buttons = screen.getAllByRole('button', { name: 'Eliminar' });
  await userEvent.click(buttons[buttons.length - 1]!);
  await screen.findByText('Conflicto de relaciones.');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
it('presenta error y reintento, luego vacío', async () => {
  vi.mocked(bancoService.list)
    .mockRejectedValueOnce(new ApiError('network', 'Sin conexión'))
    .mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
  mount();
  await screen.findByText('Sin conexión');
  await userEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
  await screen.findByText('No hay bancos para mostrar.');
});
it('permite consultar el detalle desde Ver sin permiso de escritura', async () => {
  access.write = false;
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Ver' }));
  expect(screen.getByLabelText('Denominación')).toHaveValue('Comercio');
  expect(screen.getByLabelText('Denominación')).toHaveAttribute('readonly');
  await userEvent.type(screen.getByLabelText('Denominación'), 'No cambiar');
  expect(screen.getByLabelText('Denominación')).toHaveValue('Comercio');
  fireEvent.submit(screen.getByLabelText('Denominación').closest('form')!);
  expect(bancoService.update).not.toHaveBeenCalled();
  expect(bancoService.create).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Ver banco' })).toBeInTheDocument();
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
    screen.queryByRole('button', { name: 'Actualizar desde BCRA' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Nuevo' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Editar' }),
  ).not.toBeInTheDocument();
  view.unmount();
  vi.mocked(bancoService.list).mockClear();
  access.read = false;
  mount();
  expect(
    screen.getByText('No tenés permiso para consultar bancos.'),
  ).toBeInTheDocument();
  expect(bancoService.list).not.toHaveBeenCalled();
});

it('permite eliminar sin escritura y oculta eliminar cuando falta su permiso', async () => {
  access.write = false;
  const view = mount();
  await screen.findByText('Comercio');
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  view.unmount();
  access.write = true;
  access.delete = false;
  mount();
  await screen.findByText('Comercio');
  expect(
    screen.queryByRole('button', { name: 'Eliminar' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Actualizar desde BCRA' }),
  ).toBeInTheDocument();
});

it('presenta incorporaciones parciales BCRA, invalida el listado y no repite la escritura', async () => {
  const pending = deferred<never>();
  vi.mocked(bancoService.actualizarDesdeBcra).mockReturnValue(pending.promise);
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(
    screen.getByRole('button', { name: 'Actualizar desde BCRA' }),
  );
  expect(bancoService.actualizarDesdeBcra).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  pending.reject(
    new BcraImportError({
      incorporados: 2,
      omitidos: 1,
      fallidos: [
        { codigoEntidad: 33, motivo: 'No se pudo incorporar el banco.' },
      ],
    }),
  );
  await screen.findByText(/Incorporados: 2. Omitidos: 1. Fallidos: 1/);
  expect(
    screen.getByText('Código 33: No se pudo incorporar el banco.'),
  ).toBeInTheDocument();
  expect(bancoService.actualizarDesdeBcra).toHaveBeenCalledTimes(1);
  expect(vi.mocked(bancoService.list).mock.calls.length).toBeGreaterThan(1);
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await userEvent.click(
    screen.getByRole('button', { name: 'Actualizar desde BCRA' }),
  );
  expect(screen.queryByText(/Incorporados: 2/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
});

it.each(['network', 'server'] as const)(
  'BCRA conserva un error %s sin fingir éxito',
  async (kind) => {
    vi.mocked(bancoService.actualizarDesdeBcra).mockRejectedValue(
      new ApiError(
        kind,
        'No se pudo completar la actualización.',
        kind === 'server' ? 502 : undefined,
      ),
    );
    mount();
    await screen.findByText('Comercio');
    await userEvent.click(
      screen.getByRole('button', { name: 'Actualizar desde BCRA' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await screen.findByText('No se pudo completar la actualización.');
    expect(screen.queryByText(/Incorporados:/)).not.toBeInTheDocument();
    if (kind === 'network')
      expect(
        screen.getByText(/puede haber bancos incorporados/),
      ).toBeInTheDocument();
    expect(bancoService.actualizarDesdeBcra).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bancoService.list).mock.calls.length).toBeGreaterThan(1);
  },
);

it('BCRA muestra el resumen exitoso y la baja confirmada refresca el listado', async () => {
  vi.mocked(bancoService.actualizarDesdeBcra).mockResolvedValue({
    incorporados: 2,
    omitidos: 1,
    fallidos: [],
  });
  vi.mocked(bancoService.delete).mockResolvedValue(undefined);
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(
    screen.getByRole('button', { name: 'Actualizar desde BCRA' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  await screen.findByText(/Actualización completada. Incorporados: 2/);
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
  const buttons = screen.getAllByRole('button', { name: 'Eliminar' });
  await userEvent.click(buttons[buttons.length - 1]!);
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(bancoService.delete).toHaveBeenCalledWith(7);
  expect(vi.mocked(bancoService.list).mock.calls.length).toBeGreaterThan(2);
});

it('Guardar mantiene el registro creado y el siguiente guardado actualiza su ID', async () => {
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  await screen.findByLabelText('Denominación');
  fireEvent.change(screen.getByLabelText('Denominación'), {
    target: { value: 'Creado' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByRole('dialog', { name: 'Editar banco' });
  expect(await screen.findByLabelText('Denominación')).toHaveValue('Comercio');
  expect(bancoService.create).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Denominación'), {
    target: { value: 'Actualizado' },
  });
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  );
  await waitFor(() =>
    expect(bancoService.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ denominacion: 'Actualizado' }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(bancoService.create).toHaveBeenCalledTimes(1);
});
it('Guardar y nuevo reinicia campos; Deshacer descarta cambios en alta y recarga edición', async () => {
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  await screen.findByLabelText('Denominación');
  fireEvent.change(screen.getByLabelText('Denominación'), {
    target: { value: 'Borrador' },
  });
  vi.mocked(bancoService.detail).mockResolvedValue({
    ...row,
    denominacion: 'Servidor',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Denominación')).toHaveValue('Servidor'),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y nuevo' }),
  );
  await screen.findByRole('dialog', { name: 'Nuevo banco' });
  expect(screen.getByLabelText('Denominación')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Denominación'), {
    target: { value: 'Descartar' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
  expect(screen.getByLabelText('Denominación')).toHaveValue('');
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar y cerrar' }),
  );
  await waitFor(() =>
    expect(bancoService.create).toHaveBeenCalledWith(
      expect.objectContaining({ denominacion: null }),
    ),
  );
});
it('bloquea acciones durante envío y conserva el borrador si falla', async () => {
  const pending = deferred<typeof row>();
  vi.mocked(bancoService.create).mockReturnValue(pending.promise);
  mount();
  await screen.findByText('Comercio');
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  await screen.findByLabelText('Denominación');
  fireEvent.change(screen.getByLabelText('Denominación'), {
    target: { value: 'Conservar' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  expect(screen.getByLabelText('Denominación')).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Guardar y nuevo' }),
  ).toBeDisabled();
  pending.reject(
    new ApiError('validation', 'Revisá los datos.', 400, {
      Denominacion: 'Valor rechazado',
    }),
  );
  await screen.findByText('Valor rechazado');
  expect(screen.getByLabelText('Denominación')).toHaveValue('Conservar');
  expect(screen.getByLabelText('Denominación')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
});
