import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SegurosParticularesPage } from './SegurosParticularesPage';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';

const access = vi.hoisted(() => ({ read: true }));
const seguros = vi.hoisted(() =>
  vi.fn(() => ({ query: { data: [], isFetching: false, isError: false } })),
);
vi.mock('./hooks', () => ({ useSeguros: seguros }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { empresa: { nombre: 'Empresa de prueba' } },
    isError: false,
  }),
}));
vi.mock('@/features/auth/hooks/usePermissions', () => ({
  usePermissions: () => ({
    isPending: false,
    isError: false,
    can: (permission: string) => permission === 'empresas:read' && access.read,
  }),
}));

beforeEach(() => {
  access.read = true;
  seguros.mockClear();
  useEmpresaContextStore.setState({
    empresaSeleccionadaId: null,
    seleccionBloqueada: false,
  });
});

it('no consulta seguros ni ofrece alta sin empresa seleccionada', () => {
  render(<SegurosParticularesPage />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Primero seleccioná una empresa',
  );
  expect(seguros).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Nuevo' }),
  ).not.toBeInTheDocument();
});

it('permite consultar sin ofrecer publicación cuando solo tiene lectura', () => {
  useEmpresaContextStore.getState().seleccionar(2);
  render(<SegurosParticularesPage />);
  expect(seguros).toHaveBeenCalledWith('empresa', 2);
  expect(
    screen.getByText('No hay configuración publicada para esta empresa.'),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Nuevo' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Copiar' }),
  ).not.toBeInTheDocument();
});

it('rechaza la ruta sin lectura y no consulta el historial', () => {
  access.read = false;
  useEmpresaContextStore.getState().seleccionar(2);
  render(<SegurosParticularesPage />);
  expect(
    screen.getByText(
      'No tenés permiso para consultar los seguros de empresas.',
    ),
  ).toBeVisible();
  expect(seguros).not.toHaveBeenCalled();
});
