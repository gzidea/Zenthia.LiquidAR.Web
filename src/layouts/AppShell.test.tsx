import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, it, expect, vi } from 'vitest';
import { AppShell } from './AppShell';
import userEvent from '@testing-library/user-event';
const access = vi.hoisted(() => ({ empresas: false, extra: [] as string[] }));
beforeEach(() => {
  access.empresas = false;
  access.extra = [];
});
const caps = vi.hoisted(() => ({ leer: false, generar: false }));
vi.mock('./useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('@/features/empresas/components/EmpresaGlobalSelector', () => ({
  EmpresaGlobalSelector: () => null,
}));
vi.mock('@/features/liquidaciones/hooks', () => ({
  useLiquidacionesCapacidades: () => ({ data: caps, isError: false }),
}));
vi.mock('@/features/auth/hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) =>
      (access.empresas && permission === 'empresas:read') ||
      access.extra.includes(permission),
    isError: false,
  }),
}));
vi.mock('@/features/auth/components/LogoutButton', () => ({
  LogoutButton: () => null,
}));
it.each([
  [true, false],
  [false, true],
  [true, true],
  [false, false],
])('separa los menús según lectura=%s y escritura=%s', (leer, generar) => {
  caps.leer = leer;
  caps.generar = generar;
  render(
    <MemoryRouter>
      <AppShell />
    </MemoryRouter>,
  );
  if (leer)
    expect(screen.getByRole('link', { name: 'Recibos' })).toHaveAttribute(
      'href',
      '/app/recibos',
    );
  else
    expect(
      screen.queryByRole('link', { name: 'Recibos' }),
    ).not.toBeInTheDocument();
  if (generar)
    expect(screen.getByRole('link', { name: 'Liquidaciones' })).toHaveAttribute(
      'href',
      '/app/liquidaciones',
    );
  else
    expect(
      screen.queryByRole('link', { name: 'Liquidaciones' }),
    ).not.toBeInTheDocument();
});
it('despliega Empresas debajo de Inicio sin Convenios habilitados como submenú', async () => {
  access.empresas = true;
  access.extra = ['seguros-generales:read', 'seguros-particulares:read'];
  render(
    <MemoryRouter>
      <AppShell />
    </MemoryRouter>,
  );
  const group = screen.getByRole('button', { name: 'Empresas' });
  expect(
    screen.getByRole('link', { name: 'Inicio' }).nextElementSibling,
  ).toContainElement(group);
  await userEvent.click(group);
  expect(group).toHaveAttribute('aria-expanded', 'true');
  const link = screen.getByRole('link', { name: 'Empresas' });
  expect(link).toHaveAttribute('href', '/app/empresas');
  expect(link.querySelector('svg')).toBeNull();
  expect(
    screen.queryByRole('link', { name: 'Configuración de Fórmulas' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Valores Generales SCVO / FFEP' }),
  ).toHaveAttribute('href', '/app/empresas/valores-generales');
  expect(
    screen.getByRole('link', { name: 'Seguros Particulares SCVO / ART' }),
  ).toHaveAttribute('href', '/app/empresas/seguros-particulares');
  await userEvent.click(group);
  expect(
    screen.queryByRole('link', { name: 'Empresas' }),
  ).not.toBeInTheDocument();
  access.empresas = false;
});

it.each([
  ['formulas:read', false, true, false, false],
  ['formulas:write', false, false, false, false],
  ['empresas-formulas:read', true, false, false, false],
  ['empresas-formulas:write', false, false, false, false],
  ['empresas-formulas:delete', false, false, false, false],
  ['habilitar-convenio:read', false, false, true, false],
  ['habilitar-convenio:write', false, false, false, false],
  ['reglas-ajustes:read', false, false, false, true],
  ['reglas-ajustes:write', false, false, false, false],
  ['reglas-ajustes:delete', false, false, false, false],
  ['', false, false, false, false],
])(
  'separa la lectura general y empresarial con %s',
  async (permission, empresarial, general, convenios, reglas) => {
    access.extra = [permission];
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );
    const group = screen.queryByRole('button', { name: 'Empresas' });
    expect(Boolean(group)).toBe(empresarial);
    expect(Boolean(screen.queryByRole('link', { name: 'Fórmulas' }))).toBe(
      general,
    );
    expect(
      Boolean(screen.queryByRole('link', { name: 'Convenios habilitados' })),
    ).toBe(convenios);
    expect(
      Boolean(screen.queryByRole('link', { name: 'Reglas de ajuste' })),
    ).toBe(reglas);
    if (group) {
      await userEvent.click(group);
      expect(
        screen.getByRole('link', { name: 'Configuración de Fórmulas' }),
      ).toHaveAttribute('href', '/app/empresas/configuracion-formulas');
      expect(
        screen.queryByRole('link', { name: 'Empresas' }),
      ).not.toBeInTheDocument();
    }
  },
);

it.each([
  ['empresas:read', 'Empresas', '/app/empresas'],
  [
    'seguros-generales:read',
    'Valores Generales SCVO / FFEP',
    '/app/empresas/valores-generales',
  ],
  [
    'seguros-particulares:read',
    'Seguros Particulares SCVO / ART',
    '/app/empresas/seguros-particulares',
  ],
])(
  'muestra el grupo con acceso únicamente a %s',
  async (permission, label, route) => {
    access.extra = [permission];
    const { rerender } = render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );
    const group = screen.getByRole('button', { name: 'Empresas' });
    await userEvent.click(group);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'href',
      route,
    );
    expect(
      document.getElementById('empresas-submenu')!.querySelectorAll('a'),
    ).toHaveLength(1);
    await userEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    access.extra = [];
    rerender(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole('button', { name: 'Empresas' }),
    ).not.toBeInTheDocument();
  },
);
