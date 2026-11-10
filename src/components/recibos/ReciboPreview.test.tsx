import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ReciboPreview } from './ReciboPreview';
import { parseVista } from '@/features/recibos/reciboPreview';
import { reciboVistaFixture } from '@/test/reciboVistaFixture';
it('renderiza empresa real, conceptos y secciones sin datos ficticios de la demo', () => {
  render(<ReciboPreview result={parseVista(reciboVistaFixture()).result} />);
  expect(screen.getByText('Empresa de prueba')).toBeVisible();
  expect(screen.queryByText('EMPRESA DE EJEMPLO S.A.')).not.toBeInTheDocument();
  expect(screen.getByText('PREVISUALIZACIÓN · RECIBO GUARDADO')).toBeVisible();
  expect(screen.getByText('Básico de convenio')).toBeVisible();
  expect(screen.getAllByRole('table')).toHaveLength(2);
  expect(screen.getByText(/SUELDO NETO/)).toHaveTextContent('900,00');
  expect(screen.getByRole('img')).toHaveAccessibleName(
    'Neto: $ 900,00, 82%, Seguridad social: $ 200,00, 18%',
  );
});
it('una inconsistencia no oculta los datos y queda señalada antes de imprimir', () => {
  const fixture = reciboVistaFixture();
  fixture.error =
    'Los totales no coinciden con los detalles almacenados. Recalcule antes de imprimir.';
  fixture.camposInconsistentes = ['NetoACobrar'];
  fixture.datosCompletos = false;
  render(<ReciboPreview result={parseVista(fixture).result} />);
  expect(
    within(screen.getByRole('alert')).getByText('Revisar: Neto.'),
  ).toBeVisible();
  expect(screen.getByText('Básico de convenio')).toBeVisible();
});
