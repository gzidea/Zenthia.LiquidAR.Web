import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiquidacionesPage } from './LiquidacionesPage';
import { liquidacionesService as api } from './service';
import { recibosService } from '@/features/recibos/service';
vi.mock('@/services/http/downloadFile', () => ({ descargar: vi.fn() }));
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, title, onAccept, onClose, acceptButton }: any) => (
    <div role="dialog" aria-label={title}>
      {children}
      <button onClick={onClose}>Cancelar</button>
      {acceptButton && (
        <button onClick={onAccept} disabled={acceptButton.disabled}>
          {acceptButton.label}
        </button>
      )}
    </div>
  ),
}));
const state = vi.hoisted(() => ({
  leer: true,
  generar: true,
  corregirNovedades: false,
}));
vi.mock('./hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks')>()),
  useLiquidacionesCapacidades: () => ({
    data: { ...state },
    isPending: false,
  }),
}));
vi.mock('./service', () => ({
  liquidacionesService: {
    convenios: vi.fn(),
    tipos: vi.fn(),
    empresas: vi.fn(),
    filas: vi.fn(),
    liquidar: vi.fn(),
    novedades: vi.fn(),
    corregir: vi.fn(),
  },
}));
vi.mock('@/components/ui/Select', () => ({
  Select: (props: any) => <select {...props} />,
}));
const base = {
  numero: 1,
  cuil: null,
  idRecibo: null,
  pendientes: 0,
  formulasPendientes: [],
  errores: [],
  diasTrabajados: 30,
  usaDiasCategoria: true,
  diasVacaciones: 0,
  usaVacacionesPredeterminadas: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(recibosService, 'zip').mockResolvedValue({
    blob: new Blob(['zip']),
    nombre: 'recibos.zip',
  });
  vi.mocked(api.convenios).mockResolvedValue([]);
  state.leer = true;
  state.generar = true;
  state.corregirNovedades = false;
  vi.mocked(api.tipos).mockResolvedValue([{ id: 1, nombre: 'Mensual' }]);
  vi.mocked(api.empresas).mockResolvedValue([
    { id: 1, nombre: 'Empresa', legajos: 2, conNovedades: 0, recibos: 0 },
  ]);
  vi.mocked(api.filas).mockResolvedValue({
    total: 2,
    items: [
      { ...base, idLegajo: 1, nombre: 'Disponible', seleccionable: true },
      {
        ...base,
        idLegajo: 2,
        nombre: 'Pendiente',
        seleccionable: false,
        pendientes: 1,
        formulasPendientes: [
          { id: 10, codigo: '10', descripcion: 'Premio obligatorio' },
        ],
      },
    ],
  });
  vi.mocked(api.liquidar).mockResolvedValue({ items: [] });
});
const mount = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <LiquidacionesPage />
    </QueryClientProvider>,
  );
async function open() {
  mount();
  await screen.findByRole('option', { name: 'Mensual' });
  fireEvent.change(screen.getByLabelText('Tipo de liquidación'), {
    target: { value: '1' },
  });
  await screen.findByRole('option', { name: 'Empresa' });
  fireEvent.change(screen.getByLabelText('Empresa'), {
    target: { value: '1' },
  });
  await screen.findByText('Premio obligatorio', { exact: false });
}
describe('Liquidaciones', () => {
  it.each([true, false])(
    'ofrece descarga del resultado solo si se guardó: %s',
    async (persistido) => {
      vi.mocked(api.liquidar).mockResolvedValue({
        items: [
          {
            idLegajo: 1,
            estado: persistido ? 'generado' : 'calculado',
            error: null,
            recibo: {
              reciboId: persistido ? 4 : null,
              calculado: true,
              persistido,
              cabecera: null,
              detalles: [],
              diagnosticos: [],
            },
          },
          { idLegajo: 2, estado: 'error', error: 'No generado', recibo: null },
        ],
      });
      await open();
      fireEvent.click(screen.getAllByRole('checkbox')[0]!);
      fireEvent.change(screen.getByLabelText('Fecha de pago'), {
        target: { value: '2026-10-31' },
      });
      fireEvent.click(
        screen.getByRole('button', {
          name: persistido ? 'Generar recibos' : 'Previsualizar',
        }),
      );
      if (persistido)
        fireEvent.click(screen.getByRole('button', { name: 'Generar' }));
      await screen.findByText('No generado', { exact: false });
      if (persistido) {
        fireEvent.click(
          screen.getByRole('button', {
            name: 'Descargar los recibos generados (1)',
          }),
        );
        await waitFor(() =>
          expect(recibosService.zip).toHaveBeenCalledWith(
            [4],
            expect.any(AbortSignal),
          ),
        );
      } else
        expect(
          screen.queryByRole('button', {
            name: /Descargar los recibos generados/,
          }),
        ).not.toBeInTheDocument();
    },
  );
  it('corrige novedades de un recibo con la acción explícita y su revisión', async () => {
    state.corregirNovedades = true;
    const items = (
      await api.filas(
        { idEmpresa: 1, periodo: '102026', idTipoLiquidacion: 1 },
        1,
        25,
        '',
      )
    ).items;
    items[0]!.idRecibo = 4;
    items[0]!.seleccionable = false;
    vi.mocked(api.filas).mockResolvedValue({ items, total: 2 });
    vi.mocked(api.novedades).mockResolvedValue({
      idLegajo: 1,
      numero: 1,
      nombre: 'Disponible',
      cuil: null,
      idConvenio: null,
      idNovedad: 8,
      revision: 3,
      fechaPago: '2026-10-31',
      diasTrabajados: 30,
      horasTrabajadas: null,
      diasVacaciones: 0,
      requeridas: [],
      detalles: [],
      errores: [],
      pendientes: 0,
      idRecibo: 4,
    });
    vi.mocked(api.corregir).mockResolvedValue({
      items: [{ idLegajo: 1, estado: 'guardado', error: null }],
    });
    await open();
    fireEvent.click(
      screen.getByRole('button', { name: 'Corregir novedades y recalcular' }),
    );
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar' }));
    await waitFor(() =>
      expect(api.corregir).toHaveBeenCalledWith(
        expect.objectContaining({ idEmpresa: 1 }),
        [
          expect.objectContaining({
            idLegajo: 1,
            revisionEsperada: 3,
            diasVacaciones: 0,
          }),
        ],
      ),
    );
  });
  it('mantiene el legajo pendiente visible y genera solamente el disponible con confirmacion', async () => {
    await open();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[2]).toBeDisabled();
    fireEvent.click(boxes[0]!);
    fireEvent.change(screen.getByLabelText('Fecha de pago'), {
      target: { value: '2026-10-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar recibos' }));
    expect(api.liquidar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Generar' }));
    await waitFor(() =>
      expect(api.liquidar).toHaveBeenCalledWith(
        expect.objectContaining({ idEmpresa: 1, idTipoLiquidacion: 1 }),
        '2026-10-31',
        [1],
        true,
      ),
    );
  });
  it('no permite acceder a Liquidaciones con solo lectura de recibos', () => {
    state.generar = false;
    mount();
    expect(api.filas).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('No ten');
  });
  it('no consulta datos cuando no tiene permiso de lectura', () => {
    state.leer = false;
    state.generar = false;
    mount();
    expect(api.tipos).not.toHaveBeenCalled();
    expect(api.filas).not.toHaveBeenCalled();
  });
});
