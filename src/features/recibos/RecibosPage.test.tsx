import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, it, expect, vi } from 'vitest';
import { RecibosPage } from './RecibosPage';
import { recibosService as api } from './service';
import { descargar } from '@/services/http/downloadFile';
import { ReciboZipError } from './reciboZipErrors';
import { ApiError } from '@/services/http/ApiError';
const state = vi.hoisted(() => ({ leer: true, generar: false }));
vi.mock('@/features/liquidaciones/hooks', () => ({
  useLiquidacionesCapacidades: () => ({ data: state, isPending: false }),
}));
vi.mock('./service', () => ({
  recibosService: {
    tipos: vi.fn(),
    empresas: vi.fn(),
    listado: vi.fn(),
    zip: vi.fn(),
    pdf: vi.fn(),
  },
}));
vi.mock('@/services/http/downloadFile', () => ({ descargar: vi.fn() }));
vi.mock('@/components/ui/Select', () => ({
  Select: (p: any) => <select {...p} />,
}));
const recibo = {
  id: 4,
  idEmpresa: 1,
  idLegajo: 7,
  periodo: '102026',
  idTipoLiquidacion: 1,
  fechaPago: '2026-10-31',
  sueldoBruto: '100.0000',
  totalRemunerativos: '90',
  totalNoRemunerativos: '10',
  totalDescuentos: '20',
  netoACobrar: '80',
  totalContribuciones: '30',
  totalCostoLaboral: '130',
};
beforeEach(() => {
  vi.clearAllMocks();
  state.leer = true;
  state.generar = false;
  vi.mocked(api.tipos).mockResolvedValue([{ id: 1, nombre: 'Mensual' }]);
  vi.mocked(api.empresas).mockResolvedValue([{ id: 1, nombre: 'Empresa' }]);
  vi.mocked(api.listado).mockResolvedValue({
    page: 1,
    pageSize: 25,
    total: 2,
    items: [
      {
        recibo,
        codigoLegajo: 77,
        apellidos: 'Perez',
        nombres: 'Ana',
        cuil: '27-00000000-0',
        empresa: 'Empresa',
        tipoLiquidacion: 'Mensual',
      },
      {
        recibo: { ...recibo, id: 5, idLegajo: null, netoACobrar: null },
        codigoLegajo: null,
        apellidos: null,
        nombres: null,
        cuil: null,
        empresa: 'Empresa',
        tipoLiquidacion: 'Mensual',
      },
    ],
  });
  vi.mocked(api.zip).mockResolvedValue({
    blob: new Blob(['zip']),
    nombre: 'recibos.zip',
  });
});
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RecibosPage />
    </QueryClientProvider>,
  );
}
async function open() {
  mount();
  await screen.findByRole('option', { name: 'Mensual' });
  fireEvent.change(screen.getByLabelText('Tipo de liquidación'), {
    target: { value: '1' },
  });
  await screen.findByText('Perez');
}
it('muestra código real, identidad y columnas de importes sin convertir nulos en cero', async () => {
  await open();
  expect(screen.getByText('77')).toBeInTheDocument();
  expect(screen.getByText('Ana')).toBeInTheDocument();
  expect(screen.getByText('27-00000000-0')).toBeInTheDocument();
  for (const label of [
    'Sueldo bruto',
    'Remunerativo',
    'No remunerativo',
    'Descuentos',
    'Neto a cobrar',
    'Total contribuciones',
    'Costo total',
  ])
    expect(
      screen.getByRole('button', { name: `Ordenar por ${label}` }),
    ).toBeInTheDocument();
  expect(screen.getByText('Sin calcular')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Generar|Recalcular/ }),
  ).not.toBeInTheDocument();
});
it('selecciona y descarga los IDs de recibos, con permiso de lectura', async () => {
  await open();
  fireEvent.click(screen.getAllByRole('checkbox')[0]!);
  fireEvent.click(
    screen.getByRole('button', { name: 'Descargar seleccionados en ZIP (2)' }),
  );
  await waitFor(() =>
    expect(api.zip).toHaveBeenCalledWith([4, 5], expect.any(AbortSignal)),
  );
  await waitFor(() => expect(descargar).toHaveBeenCalled());
});
it('envía búsqueda y orden al servidor y reinicia la selección', async () => {
  await open();
  fireEvent.click(screen.getAllByRole('checkbox')[0]!);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Ana' } });
  await waitFor(() =>
    expect(api.listado).toHaveBeenLastCalledWith(
      expect.objectContaining({ buscar: 'Ana', page: 1 }),
      expect.any(AbortSignal),
    ),
  );
  expect(
    screen.getByRole('button', { name: 'Descargar seleccionados en ZIP (0)' }),
  ).toBeDisabled();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Ordenar por Neto a cobrar' }),
    ).toBeEnabled(),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Ordenar por Neto a cobrar' }),
  );
  await waitFor(() =>
    expect(api.listado).toHaveBeenLastCalledWith(
      expect.objectContaining({ orden: 'netoACobrar' }),
      expect.any(AbortSignal),
    ),
  );
});
it('muestra el rechazo completo y permite excluir los recibos fallidos', async () => {
  vi.mocked(api.zip).mockRejectedValue(
    new ReciboZipError([{ reciboId: 4, mensaje: 'Totales inconsistentes.' }]),
  );
  await open();
  fireEvent.click(screen.getAllByRole('checkbox')[0]!);
  fireEvent.click(
    screen.getByRole('button', { name: 'Descargar seleccionados en ZIP (2)' }),
  );
  await screen.findByText(/Recibo 4: Totales/);
  expect(descargar).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Quitar recibos con error de la selección',
    }),
  );
  expect(
    screen.getByRole('button', { name: 'Descargar seleccionados en ZIP (1)' }),
  ).toBeEnabled();
});
it('cancela la preparación sin descargar', async () => {
  vi.mocked(api.zip).mockImplementation(
    (_ids, signal) =>
      new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () =>
          reject(new ApiError('cancelled', 'Cancelada')),
        ),
      ),
  );
  await open();
  fireEvent.click(screen.getAllByRole('checkbox')[0]!);
  fireEvent.click(
    screen.getByRole('button', { name: 'Descargar seleccionados en ZIP (2)' }),
  );
  await screen.findByText('Preparando archivo…');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar descarga' }));
  await screen.findByText('Descarga cancelada.');
  expect(descargar).not.toHaveBeenCalled();
});
it('un usuario con solo escritura no consulta el listado', () => {
  state.leer = false;
  state.generar = true;
  mount();
  expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso');
  expect(api.listado).not.toHaveBeenCalled();
  expect(api.tipos).not.toHaveBeenCalled();
});
