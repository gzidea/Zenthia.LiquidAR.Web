import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';
import { ConfiguracionFormulasPage } from './ConfiguracionFormulasPage';
import { formulasEmpresaApi } from './service';

const access = vi.hoisted(() => ({
  permissions: ['empresas-formulas:read'] as string[],
  isPending: false,
  isError: false,
}));
vi.mock('@/features/auth/hooks/usePermissions', () => ({
  usePermissions: () => ({
    ...access,
    can: (p: string) =>
      !access.isPending && !access.isError && access.permissions.includes(p),
    refetch: vi.fn(),
  }),
}));
vi.mock('./service', () => ({ formulasEmpresaApi: { empresa: vi.fn() } }));
vi.mock('./EmpresaFormulasContent', () => ({
  EmpresaFormulasContent: ({
    empresa,
    canWrite,
  }: {
    empresa: { nombre: string };
    canWrite: boolean;
  }) => (
    <p>
      {empresa.nombre} · {canWrite ? 'Escritura' : 'Lectura'}
    </p>
  ),
}));
beforeEach(() => {
  vi.resetAllMocks();
  access.permissions = ['empresas-formulas:read'];
  access.isPending = false;
  access.isError = false;
  useEmpresaContextStore.setState({
    empresaSeleccionadaId: null,
    seleccionBloqueada: false,
  });
});
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ConfiguracionFormulasPage />
    </QueryClientProvider>,
  );
}
it('indica que debe seleccionarse empresa sin consultar datos', () => {
  mount();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Seleccioná una empresa',
  );
  expect(formulasEmpresaApi.empresa).not.toHaveBeenCalled();
});
it.each([false, true])(
  'utiliza las capacidades de escritura=%s sin depender de empresas:read',
  async (puedeEscribir) => {
    if (puedeEscribir) access.permissions.push('empresas-formulas:write');
    useEmpresaContextStore.setState({ empresaSeleccionadaId: 10 });
    vi.mocked(formulasEmpresaApi.empresa).mockResolvedValue({
      id: 10,
      nombre: 'Empresa A',
      codigo: 1,
      claveUnica: null,
    });
    mount();
    expect(
      await screen.findByText(
        `Empresa A · ${puedeEscribir ? 'Escritura' : 'Lectura'}`,
      ),
    ).toBeVisible();
  },
);
it.each([
  'formulas:read',
  'formulas:write',
  'empresas-formulas:write',
  'empresas-formulas:delete',
  'habilitar-convenio:read',
  'habilitar-convenio:write',
  'reglas-ajustes:read',
  'reglas-ajustes:write',
  'reglas-ajustes:delete',
  'empresas:read',
])('bloquea la ruta sin lectura empresarial con %s', (permission) => {
  access.permissions = [permission];
  useEmpresaContextStore.setState({ empresaSeleccionadaId: 10 });
  mount();
  expect(screen.getByText(/No tenés acceso/)).toBeVisible();
  expect(formulasEmpresaApi.empresa).not.toHaveBeenCalled();
});
it('muestra el error de empresa sin montar su configuración', async () => {
  useEmpresaContextStore.setState({ empresaSeleccionadaId: 10 });
  vi.mocked(formulasEmpresaApi.empresa).mockRejectedValue(new Error('offline'));
  mount();
  expect(
    await screen.findByRole('button', { name: 'Reintentar empresa' }),
  ).toBeVisible();
  expect(screen.queryByText(/Empresa A/)).not.toBeInTheDocument();
});

it('retira la configuración anterior al cambiar de empresa y al limpiar la selección', async () => {
  vi.mocked(formulasEmpresaApi.empresa).mockImplementation(async (id) => ({
    id,
    nombre: id === 10 ? 'Empresa A' : 'Empresa B',
    codigo: id,
    claveUnica: null,
  }));
  useEmpresaContextStore.setState({ empresaSeleccionadaId: 10 });
  mount();
  expect(await screen.findByText('Empresa A · Lectura')).toBeVisible();
  act(() => useEmpresaContextStore.getState().seleccionar(20));
  expect(screen.queryByText('Empresa A · Lectura')).not.toBeInTheDocument();
  expect(await screen.findByText('Empresa B · Lectura')).toBeVisible();
  act(() => useEmpresaContextStore.getState().limpiar());
  expect(screen.queryByText('Empresa B · Lectura')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Seleccioná una empresa',
  );
});
