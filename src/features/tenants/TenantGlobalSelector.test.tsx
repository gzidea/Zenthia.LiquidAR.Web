import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantGlobalSelector } from './TenantGlobalSelector';
import { useTenantContextStore } from '@/stores/tenantContextStore';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';
import { listActiveTenants } from './service';
vi.mock('./service', () => ({ listActiveTenants: vi.fn() }));
beforeEach(() => {
  useTenantContextStore.setState({ tenant: null, revision: 0 });
  useEmpresaContextStore.setState({
    empresaSeleccionadaId: 12,
    seleccionBloqueada: false,
  });
  vi.mocked(listActiveTenants).mockResolvedValue([
    { id: 2, name: 'Cliente dos' },
    { id: 3, name: 'Cliente tres' },
  ]);
});
function setup() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <TenantGlobalSelector />
    </QueryClientProvider>,
  );
}
it('busca, selecciona y vuelve al contexto global limpiando la empresa', async () => {
  const user = userEvent.setup();
  setup();
  await user.click(
    screen.getByRole('button', { name: 'Tenant: Todos los tenants' }),
  );
  await screen.findByText('Cliente dos');
  await user.type(
    screen.getByRole('searchbox', { name: 'Buscar tenant' }),
    'tres',
  );
  expect(screen.queryByText('Cliente dos')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Cliente tres/ }));
  expect(useTenantContextStore.getState().tenant?.id).toBe(3);
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBeNull();
  await user.click(
    screen.getByRole('button', { name: 'Tenant: Cliente tres' }),
  );
  await user.click(screen.getByRole('button', { name: 'Todos los tenants' }));
  expect(useTenantContextStore.getState().tenant).toBeNull();
});
it('permite reintentar errores sin perder el contexto seleccionado', async () => {
  vi.mocked(listActiveTenants).mockRejectedValueOnce(new Error('offline'));
  const user = userEvent.setup();
  setup();
  await user.click(
    screen.getByRole('button', { name: 'Tenant: Todos los tenants' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudieron cargar',
  );
  await user.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByText('Cliente dos');
  expect(useTenantContextStore.getState().tenant).toBeNull();
});
it('bloquea el cambio durante una edición protegida', () => {
  useEmpresaContextStore.setState({ seleccionBloqueada: true });
  setup();
  expect(
    screen.getByRole('button', { name: 'Tenant: Todos los tenants' }),
  ).toBeDisabled();
});
