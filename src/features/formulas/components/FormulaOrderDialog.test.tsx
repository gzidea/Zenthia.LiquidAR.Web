import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { FormulaOrderDialog } from './FormulaOrderDialog';
import { formulaService } from '../services/formulaService';
import { ApiError } from '@/services/http/ApiError';

const snapshot = {
  huella: 'version-original',
  formulas: Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    codigo: index + 1,
    descripcion: `Fórmula ${index + 1}`,
    variable: `C3${index + 1}`,
    orden: index + 1,
    activo: index % 2 === 0,
  })),
};
beforeEach(() => {
  vi.restoreAllMocks();
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
  vi.spyOn(formulaService, 'order').mockResolvedValue(snapshot);
  vi.spyOn(formulaService, 'saveOrder').mockResolvedValue(snapshot);
});
function mount() {
  const close = vi.fn();
  const saved = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <FormulaOrderDialog
        convenioId={3}
        convenioNombre="Comercio"
        onClose={close}
        onSaved={saved}
      />
    </QueryClientProvider>,
  );
  return { close, saved };
}
it('carga el convenio completo y guarda una secuencia que atraviesa páginas de la grilla', async () => {
  const user = userEvent.setup();
  const { saved } = mount();
  const table = await screen.findByRole('table');
  expect(within(table).getAllByRole('row')).toHaveLength(31);
  expect(within(table).getAllByText('Inactivo')).toHaveLength(15);
  await user.click(screen.getByRole('button', { name: 'Subir Fórmula 30' }));
  await user.click(screen.getByRole('button', { name: 'Guardar orden' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(formulaService.saveOrder).toHaveBeenCalledWith(
    3,
    [...Array.from({ length: 28 }, (_, i) => i + 1), 30, 29],
    'version-original',
  );
});
it('cancelar sin cambios cierra y cancelar con cambios permite descartarlos', async () => {
  const user = userEvent.setup();
  const { close } = mount();
  await screen.findByRole('table');
  await user.click(screen.getByRole('button', { name: 'Bajar Fórmula 1' }));
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(close).not.toHaveBeenCalled();
  const confirm = screen.getByRole('dialog', {
    name: 'Descartar cambios de orden',
  });
  await user.click(
    within(confirm).getByRole('button', {
      name: 'Descartar cambios',
    }),
  );
  expect(close).toHaveBeenCalledOnce();
  expect(formulaService.saveOrder).not.toHaveBeenCalled();
});
it('conserva la secuencia del borrador ante un conflicto', async () => {
  vi.mocked(formulaService.saveOrder).mockRejectedValue(
    new ApiError('conflict', 'Conflicto', 409),
  );
  const user = userEvent.setup();
  const { saved } = mount();
  const table = await screen.findByRole('table');
  await user.click(screen.getByRole('button', { name: 'Bajar Fórmula 1' }));
  await user.click(screen.getByRole('button', { name: 'Guardar orden' }));
  await screen.findByText(/Las fórmulas o su orden cambiaron/);
  expect(saved).not.toHaveBeenCalled();
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Fórmula 2');
});
it('cancelar sin movimientos no realiza escrituras', async () => {
  const user = userEvent.setup();
  const { close } = mount();
  await screen.findByRole('table');
  expect(screen.getByRole('button', { name: 'Guardar orden' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(close).toHaveBeenCalledOnce();
  expect(formulaService.saveOrder).not.toHaveBeenCalled();
});

it('bloquea movimientos, cierre y envíos duplicados durante el guardado', async () => {
  let release!: (value: typeof snapshot) => void;
  vi.mocked(formulaService.saveOrder).mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const user = userEvent.setup();
  const { close, saved } = mount();
  await screen.findByRole('table');
  await user.click(screen.getByRole('button', { name: 'Bajar Fórmula 1' }));
  await user.click(screen.getByRole('button', { name: 'Guardar orden' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled(),
  );
  expect(
    screen.getByRole('button', { name: 'Subir Fórmula 1' }),
  ).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(close).not.toHaveBeenCalled();
  expect(formulaService.saveOrder).toHaveBeenCalledOnce();
  await act(async () => release(snapshot));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
});

it('permite reintentar una carga fallida y no guarda un convenio vacío', async () => {
  vi.mocked(formulaService.order)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ formulas: [], huella: 'vacío' });
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
  await screen.findByText('No hay fórmulas en este convenio.');
  expect(screen.getByRole('button', { name: 'Guardar orden' })).toBeDisabled();
  expect(formulaService.saveOrder).not.toHaveBeenCalled();
});
