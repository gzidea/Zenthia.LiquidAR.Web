import { render, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ReciboHtml } from './ReciboHtml';
import type { DemoResultado } from './types';

function result(empleador: number, trabajador: number): DemoResultado {
  return {
    calculado: true,
    nombre: 'Ana',
    fechaIngreso: '2020-01-01',
    convenio: 'Convenio',
    categoria: 'Categoría',
    periodo: '102026',
    fechaReferencia: '2026-10-20',
    antiguedad: '6 años',
    importeCategoria: 1000,
    detalles: [],
    diagnosticos: [],
    totales: {
      remunerativo: 800 + trabajador,
      noRemunerativo: 0,
      descuentos: trabajador,
      contribuciones: empleador,
      bruto: 800 + trabajador,
      neto: 800,
      costoTotal: 800 + empleador + trabajador,
    },
    grupos: [
      {
        idGrupoCosto: 1,
        titulo: 'Seguridad Social',
        empleador,
        trabajador,
        total: empleador + trabajador,
      },
    ],
  };
}
it.each([
  [150, 50],
  [0, 200],
  [200, 0],
])(
  'grafica neto más el total del grupo: empleador %s, trabajador %s',
  (empleador, trabajador) => {
    const { container } = render(
      <ReciboHtml result={result(empleador!, trabajador!)} />,
    );
    const chart = within(
      container.querySelector('.receipt-chart')! as HTMLElement,
    );
    expect(chart.getByRole('img')).toHaveAccessibleName(
      'Neto: $ 800,00, 80%, Seguridad Social: $ 200,00, 20%',
    );
    expect(chart.getAllByRole('listitem')).toHaveLength(2);
    expect(chart.getByText('Seguridad Social · $ 200,00 · 20%')).toBeVisible();
  },
);
it('incluye todos los grupos sin sumar dos veces las partes', () => {
  const data = result(150, 50);
  data.grupos.push({
    idGrupoCosto: 2,
    titulo: 'Otros costos',
    empleador: 100,
    trabajador: 100,
    total: 200,
  });
  const { container } = render(<ReciboHtml result={data} />);
  const chart = within(
    container.querySelector('.receipt-chart')! as HTMLElement,
  );
  expect(chart.getByRole('img')).toHaveAccessibleName(
    'Neto: $ 800,00, 67%, Seguridad Social: $ 200,00, 17%, Otros costos: $ 200,00, 17%',
  );
  expect(chart.getAllByRole('listitem')).toHaveLength(3);
});
it('representa solo neto si los grupos están en cero o ausentes', () => {
  const data = result(0, 0);
  const { container, rerender } = render(<ReciboHtml result={data} />);
  expect(
    within(container.querySelector('.receipt-chart')! as HTMLElement).getByRole(
      'img',
    ),
  ).toHaveAccessibleName('Neto: $ 800,00, 100%');
  rerender(<ReciboHtml result={{ ...data, grupos: [] }} />);
  expect(
    within(
      container.querySelector('.receipt-chart')! as HTMLElement,
    ).getAllByRole('listitem'),
  ).toHaveLength(1);
});
it.each(['neto negativo', 'grupo negativo', 'todo cero'])(
  'no dibuja proporciones engañosas: %s',
  (scenario) => {
    const data = scenario === 'grupo negativo' ? result(-100, 0) : result(0, 0);
    data.totales!.neto =
      scenario === 'neto negativo' ? -10 : scenario === 'todo cero' ? 0 : 800;
    const { container } = render(<ReciboHtml result={data} />);
    const chart = within(
      container.querySelector('.receipt-chart')! as HTMLElement,
    );
    expect(chart.queryByRole('img')).not.toBeInTheDocument();
    expect(
      chart.getByText(
        'No hay una composición representable para estos importes.',
      ),
    ).toBeVisible();
  },
);
