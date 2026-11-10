import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { recibosService } from './service';
import { parseVista } from './reciboPreview';
import { reciboVistaFixture } from '@/test/reciboVistaFixture';
import { ReciboPreviewDialog } from './ReciboPreviewDialog';
import { ApiError } from '@/services/http/ApiError';
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, actions, onClose, closeDisabled }: any) => (
    <div role="dialog">
      {children}
      {actions}
      <button disabled={closeDisabled} onClick={onClose}>
        Cerrar
      </button>
    </div>
  ),
}));
afterEach(() => vi.restoreAllMocks());
function open(
  target: { id: number } | { vista: unknown },
  dirty = false,
  canRecalculate = true,
) {
  const onPdf = vi.fn(),
    onRecalcular = vi.fn(),
    onClose = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <ReciboPreviewDialog
        target={target}
        busy={false}
        dirty={dirty}
        canRecalculate={canRecalculate}
        onClose={onClose}
        onPdf={onPdf}
        onRecalcular={onRecalcular}
      />
    </QueryClientProvider>,
  );
  return { onPdf, onRecalcular, onClose };
}
it('consulta el recibo guardado y ofrece PDF y recálculo para ese ID', async () => {
  const read = vi
    .spyOn(recibosService, 'previsualizacion')
    .mockResolvedValue(parseVista(reciboVistaFixture()));
  const callbacks = open({ id: 4 });
  await screen.findByText('Empresa de prueba');
  expect(read).toHaveBeenCalledWith(4, expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
  expect(callbacks.onPdf).toHaveBeenCalledWith(4);
  fireEvent.click(screen.getByRole('button', { name: 'Recalcular recibo' }));
  expect(callbacks.onRecalcular).toHaveBeenCalledWith(4);
});
it('no ofrece emisión cuando hay inconsistencias y bloquea recálculo con borradores', async () => {
  const fixture = reciboVistaFixture();
  fixture.datosCompletos = false;
  fixture.error =
    'Los totales no coinciden con los detalles almacenados. Recalcule antes de imprimir.';
  vi.spyOn(recibosService, 'previsualizacion').mockResolvedValue(
    parseVista(fixture),
  );
  open({ id: 4 }, true);
  await screen.findByText('Empresa de prueba');
  expect(
    screen.queryByRole('button', { name: 'Descargar PDF' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Recalcular recibo' }),
  ).toBeDisabled();
});
it('una simulación muestra el mismo esquema sin consultar ni persistir recibos', async () => {
  const fixture = reciboVistaFixture();
  fixture.persistido = false;
  const read = vi.spyOn(recibosService, 'previsualizacion');
  open({ vista: fixture });
  await screen.findByText('SIMULACIÓN · SIN VALIDEZ LABORAL');
  expect(read).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Descargar PDF' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Recalcular recibo' }),
  ).not.toBeInTheDocument();
});
it('permite reintentar una lectura fallida y respeta la capacidad de escritura', async () => {
  const read = vi
    .spyOn(recibosService, 'previsualizacion')
    .mockRejectedValueOnce(new ApiError('network', 'No pudimos conectar.'))
    .mockResolvedValue(parseVista(reciboVistaFixture()));
  open({ id: 4 }, false, false);
  await screen.findByText('No pudimos conectar.');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByText('Empresa de prueba');
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  expect(
    screen.queryByRole('button', { name: 'Recalcular recibo' }),
  ).not.toBeInTheDocument();
});
