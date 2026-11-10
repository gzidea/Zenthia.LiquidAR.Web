import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { EmpresaGlobalSelector } from './EmpresaGlobalSelector';
import { empresaService } from '../services/empresaService';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';
import { formulasEmpresaApi } from '@/features/formulas-empresa/service';

vi.mock('@/features/formulas-empresa/service', () => ({
  formulasEmpresaApi: { empresas: vi.fn(), empresa: vi.fn() },
}));

vi.mock('../services/empresaService', () => ({
  empresaService: { selector: vi.fn(), detail: vi.fn() },
}));
beforeEach(() => {
  vi.resetAllMocks();
  useEmpresaContextStore.getState().limpiar();
});
function mount(enabled = true, formulasOnly = false) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EmpresaGlobalSelector enabled={enabled} formulasOnly={formulasOnly} />
    </QueryClientProvider>,
  );
}
it('sin permiso no consulta empresas', () => {
  mount(false);
  expect(
    screen.getByRole('button', { name: /Seleccionar empresa/ }),
  ).toBeDisabled();
  expect(empresaService.selector).not.toHaveBeenCalled();
});

it('selecciona con acceso a fórmulas sin consultar el detalle completo de empresas', async () => {
  const empresa = {
    id: 10,
    codigo: 1,
    nombre: 'Empresa de fórmulas',
    claveUnica: null,
  };
  vi.mocked(formulasEmpresaApi.empresas).mockResolvedValue({
    items: [empresa],
    page: 1,
    pageSize: 25,
    total: 1,
  });
  vi.mocked(formulasEmpresaApi.empresa).mockResolvedValue(empresa);
  mount(true, true);
  fireEvent.click(screen.getByRole('button', { name: /Seleccionar empresa/ }));
  fireEvent.click(
    await screen.findByRole('button', { name: /Empresa de fórmulas/ }),
  );
  expect(await screen.findByText('Empresa de fórmulas')).toBeVisible();
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBe(10);
  expect(empresaService.selector).not.toHaveBeenCalled();
  expect(empresaService.detail).not.toHaveBeenCalled();
});
it('muestra vacío y permite limpiar la selección', async () => {
  vi.mocked(empresaService.selector).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
  });
  mount();
  fireEvent.click(screen.getByRole('button', { name: /Seleccionar empresa/ }));
  expect(await screen.findByText('No hay empresas disponibles.')).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Sin empresa seleccionada' }),
  );
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBeNull();
});
it('muestra error y recupera el listado al reintentar', async () => {
  vi.mocked(empresaService.selector)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
  mount();
  fireEvent.click(screen.getByRole('button', { name: /Seleccionar empresa/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudieron cargar',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('No hay empresas disponibles.')).toBeVisible();
});
