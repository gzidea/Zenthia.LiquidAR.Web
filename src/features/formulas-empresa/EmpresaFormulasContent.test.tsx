import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  within,
  waitFor,
  cleanup,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/services/http/ApiError';
import { EmpresaFormulasContent } from './EmpresaFormulasContent';
import { formulasEmpresaApi as api, type Agrupacion } from './service';
import type { Empresa } from '@/features/empresas/types/empresa';

vi.mock('./service', () => ({
  formulasEmpresaApi: {
    agrupaciones: vi.fn(),
    opciones: vi.fn(),
    propias: vi.fn(),
    exclusiones: vi.fn(),
    catalogos: vi.fn(),
    convenios: vi.fn(),
    guardarGrupo: vi.fn(),
    publicar: vi.fn(),
    guardarExclusion: vi.fn(),
    habilitar: vi.fn(),
    central: vi.fn(),
  },
}));
const empresa = { id: 10, nombre: 'Empresa A' } as Empresa;
let grupos: Agrupacion[];
function mount(canWrite = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EmpresaFormulasContent empresa={empresa} canWrite={canWrite} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
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
  vi.clearAllMocks();
  grupos = [];
  vi.mocked(api.agrupaciones).mockImplementation(async () => [...grupos]);
  vi.mocked(api.opciones).mockResolvedValue([
    {
      id: 1,
      codigo: 1,
      descripcion: 'No remunerativo A',
      convenioId: 3,
      columna: 2,
      idEmpresa: null,
    },
    {
      id: 2,
      codigo: 2,
      descripcion: 'No remunerativo B',
      convenioId: 3,
      columna: 2,
      idEmpresa: null,
    },
  ]);
  vi.mocked(api.propias).mockResolvedValue([]);
  vi.mocked(api.exclusiones).mockResolvedValue([]);
  vi.mocked(api.catalogos).mockResolvedValue({
    convenios: [],
    conceptos: [],
    unidades: [],
    meses: [],
    tiposLiquidacion: [],
  });
  vi.mocked(api.convenios).mockResolvedValue([
    { id: 3, nombre: 'Comercio', habilitado: true },
  ]);
  vi.mocked(api.habilitar).mockResolvedValue(true);
  vi.mocked(api.guardarGrupo).mockImplementation(async (_empresa, id, data) => {
    const row: Agrupacion = {
      id: id ?? 1,
      idEmpresa: 10,
      descripcion: data.descripcion,
      orden: data.orden,
      periodoDesde: `${data.periodoDesde.slice(2)}-${data.periodoDesde.slice(0, 2)}-01`,
      periodoHasta: null,
      activa: data.activa,
      formulas: data.formulas,
      revision: data.revisionEsperada + 1,
    };
    grupos = [row];
    return row;
  });
});
afterEach(cleanup);

describe('configuración de fórmulas por empresa', () => {
  it('valida integrantes y conserva el ID y revisión en los sucesivos guardados', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('No hay agrupaciones para esta empresa.');
    await user.click(screen.getByRole('button', { name: 'Nuevo' }));
    const editor = await screen.findByRole('dialog', {
      name: 'Nueva agrupación',
    });
    await user.type(
      within(editor).getByLabelText('Descripción en el recibo'),
      'No remunerativo unificado',
    );
    await user.click(within(editor).getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Seleccione al menos dos fórmulas.');
    expect(api.guardarGrupo).not.toHaveBeenCalled();
    await user.click(
      within(editor).getByRole('checkbox', { name: /1 · No remunerativo A/ }),
    );
    await user.click(
      within(editor).getByRole('checkbox', { name: /2 · No remunerativo B/ }),
    );
    await user.click(within(editor).getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('dialog', { name: 'Editar agrupación' });
    await waitFor(() => expect(api.guardarGrupo).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.guardarGrupo).mock.calls[0]).toEqual([
      10,
      null,
      expect.objectContaining({ formulas: [1, 2], revisionEsperada: 0 }),
    ]);
    const editar = screen.getByRole('dialog', { name: 'Editar agrupación' });
    await user.click(
      within(editar).getByRole('button', { name: 'Guardar y cerrar' }),
    );
    await waitFor(() => expect(api.guardarGrupo).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.guardarGrupo).mock.calls[1]).toEqual([
      10,
      1,
      expect.objectContaining({ revisionEsperada: 1 }),
    ]);
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Editar agrupación' }),
      ).not.toBeInTheDocument(),
    );
    expect(grupos).toHaveLength(1);
  });

  it('mantiene el borrador ante un conflicto y permite cancelar sin guardar', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('No hay agrupaciones para esta empresa.');
    await user.click(screen.getByRole('button', { name: 'Nuevo' }));
    const editor = await screen.findByRole('dialog', {
      name: 'Nueva agrupación',
    });
    await user.type(
      within(editor).getByLabelText('Descripción en el recibo'),
      'Borrador conservado',
    );
    await user.click(
      within(editor).getByRole('checkbox', { name: /1 · No remunerativo A/ }),
    );
    await user.click(
      within(editor).getByRole('checkbox', { name: /2 · No remunerativo B/ }),
    );
    vi.mocked(api.guardarGrupo).mockRejectedValueOnce(
      new ApiError(
        'conflict',
        'La agrupación cambió. Vuelva a consultarla.',
        409,
      ),
    );
    await user.click(
      within(editor).getByRole('button', { name: 'Guardar y cerrar' }),
    );
    await screen.findByText('La agrupación cambió. Vuelva a consultarla.');
    expect(
      within(editor).getByLabelText('Descripción en el recibo'),
    ).toHaveValue('Borrador conservado');
    expect(
      within(editor).getByRole('checkbox', { name: /1 · No remunerativo A/ }),
    ).toBeChecked();
    await user.click(within(editor).getByRole('button', { name: 'Cancelar' }));
    expect(api.guardarGrupo).toHaveBeenCalledTimes(1);
  });

  it('permite consultar una agrupación sin ofrecer escritura', async () => {
    const user = userEvent.setup();
    grupos = [
      {
        id: 1,
        idEmpresa: 10,
        descripcion: 'Unificado',
        orden: 0,
        periodoDesde: '2026-10-01',
        periodoHasta: null,
        activa: true,
        formulas: [1, 2],
        revision: 1,
      },
    ];
    mount(false);
    await screen.findByText('Unificado');
    expect(
      screen.queryByRole('button', { name: 'Nuevo' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver' }));
    const editor = await screen.findByRole('dialog', {
      name: 'Ver agrupación',
    });
    expect(
      within(editor).getByLabelText('Descripción en el recibo'),
    ).toBeDisabled();
    expect(
      within(editor).queryByRole('button', { name: /Guardar/ }),
    ).not.toBeInTheDocument();
  });

  it('ya no administra convenios desde el modal de la empresa', async () => {
    mount();
    await screen.findByRole('button', { name: 'Nuevo' });
    expect(
      screen.queryByRole('button', { name: 'Convenios habilitados' }),
    ).not.toBeInTheDocument();
    expect(api.convenios).not.toHaveBeenCalled();
  });
});
