import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ReciboDemoPage } from './ReciboDemoPage';
import { reciboDemoService } from './service';
import type { DemoResultado } from './types';

const result: DemoResultado = {
  calculado: true,
  nombre: 'Ana',
  fechaIngreso: '2016-01-02',
  convenio: 'Convenio A',
  categoria: 'Categoría A',
  periodo: '102026',
  fechaReferencia: '2026-10-14',
  antiguedad: 'Años: 10 Meses: 9',
  importeCategoria: 1000,
  detalles: [
    {
      formulaId: 1,
      descripcion: 'Básico A',
      cantidad: 30,
      base: 1000,
      importe: 1000,
      remunerativo: 1000,
      noRemunerativo: 0,
      descuento: 0,
      contribuciones: 0,
    },
  ],
  totales: {
    remunerativo: 1000,
    noRemunerativo: 0,
    descuentos: 0,
    contribuciones: 0,
    bruto: 1000,
    neto: 1000,
    costoTotal: 1000,
  },
  grupos: [],
  diagnosticos: [],
};
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(reciboDemoService, 'inicio').mockResolvedValue({
    periodoInicial: '2026-10',
    tipoLiquidacion: 'Mensual',
    fechaReferencia: '2026-10-14',
    jornadaHoras: 1,
    nombre: 'Ana',
    fechaIngreso: '2016-01-02',
    convenios: [
      { id: 1, nombre: 'Convenio A' },
      { id: 2, nombre: 'Convenio B' },
    ],
    seguros: {
      regimen: 'general',
    },
  });
  vi.spyOn(reciboDemoService, 'categorias').mockImplementation(async (id) => [
    { id, nombre: 'Categoría ' + id },
  ]);
  vi.spyOn(reciboDemoService, 'calcular').mockImplementation(
    async (request) => ({
      ...result,
      nombre: request.nombre,
      detalles: [
        {
          ...result.detalles[0]!,
          formulaId: request.convenioId,
          descripcion: 'Básico ' + request.convenioId,
        },
      ],
    }),
  );
});
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <ReciboDemoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it('informa el escenario fijo de seguros sin enviar condiciones del visitante', async () => {
  mount();
  const scenario = await screen.findByText(
    /Seguros de muestra: régimen General/,
  );
  expect(scenario).toHaveTextContent(
    'SCVO y FFEP usan los valores oficiales vigentes para el período.',
  );
  await screen.findByText('Básico 1', {}, { timeout: 4000 });
  const request = vi.mocked(reciboDemoService.calcular).mock.calls.at(-1)?.[0];
  expect(request).not.toHaveProperty('seguros');
  expect(request).not.toHaveProperty('empresaId');
});
it(
  'calcula inicialmente y cambia conceptos solo con una categoría del convenio nuevo',
  { timeout: 15000 },
  async () => {
    mount();
    const user = userEvent.setup();
    expect(
      await screen.findByText('Básico 1', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Convenio'), '2');
    await waitFor(() =>
      expect(screen.getByLabelText('Categoría')).toHaveValue('0'),
    );
    expect(screen.queryByText('Básico 1')).not.toBeInTheDocument();
    await screen.findByRole('option', { name: 'Categoría 2' });
    await user.selectOptions(screen.getByLabelText('Categoría'), '2');
    expect(
      await screen.findByText('Básico 2', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(reciboDemoService.calcular).toHaveBeenLastCalledWith(
      expect.objectContaining({ convenioId: 2, categoriaId: 2 }),
      expect.any(AbortSignal),
    );
  },
);
it('permite simular un mes futuro', { timeout: 15000 }, async () => {
  mount();
  await screen.findByText('Básico 1', {}, { timeout: 4000 });
  const periodo = screen.getByLabelText('Período de liquidación');
  expect(periodo).not.toHaveAttribute('max');
  fireEvent.change(periodo, { target: { value: '2026-11' } });
  await waitFor(() =>
    expect(reciboDemoService.calcular).toHaveBeenLastCalledWith(
      expect.objectContaining({ periodo: '2026-11' }),
      expect.any(AbortSignal),
    ),
  );
});
it('muestra indisponibilidad y permite reintentar sin login', async () => {
  vi.mocked(reciboDemoService.inicio).mockRejectedValueOnce(
    new Error('offline'),
  );
  mount();
  const user = userEvent.setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'La demostración no está disponible',
  );
  await user.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(
    await screen.findByText('Básico 1', {}, { timeout: 4000 }),
  ).toBeInTheDocument();
});
it('no presenta totales si el motor devuelve dependencias faltantes', async () => {
  vi.mocked(reciboDemoService.calcular).mockResolvedValue({
    ...result,
    calculado: false,
    totales: null,
    diagnosticos: [
      {
        codigo: 'NovedadRequerida',
        concepto: 'Adicional',
        mensaje: 'Falta una novedad.',
      },
    ],
  });
  mount();
  expect(
    await screen.findByRole('alert', {}, { timeout: 4000 }),
  ).toHaveTextContent('Falta una novedad.');
  expect(screen.queryByText('SUELDO NETO')).not.toBeInTheDocument();
});
