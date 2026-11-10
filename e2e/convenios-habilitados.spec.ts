import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';

test.setTimeout(90_000);
async function prepare(page: Page, write = true) {
  const catalog = Array.from({ length: 35 }, (_, i) => ({
    id: i + 1,
    nombre: ['Comercio', 'Construcción', 'Sanidad'][i] ?? `Convenio ${i + 1}`,
    agregado: !write && i === 0,
    habilitado: !write && i === 0,
  }));
  const state = {
    fail: false,
    blocked: false,
    writes: [] as { method: string; ids: number[] }[],
    release: () => {},
  };
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/auth/login')
      return route.fulfill({ json: loginResponse() });
    if (path === '/api/users/me')
      return route.fulfill({
        json: {
          actor: {
            userId: 7,
            tenantId: 2,
            applicationId: 42,
            isSuperAdmin: false,
            permissions: write
              ? ['formulas:read', 'formulas:write']
              : ['formulas:read'],
          },
        },
      });
    if (path === '/api/configuracion/formulas-empresa')
      return route.fulfill({
        json: {
          enabled: true,
          puedeLeer: true,
          puedeEscribir: write,
          puedeEscribirCentral: false,
        },
      });
    if (path === '/api/liquidaciones/capacidades')
      return route.fulfill({
        json: { leer: false, generar: false, corregirNovedades: false },
      });
    if (path === '/api/configuracion/convenios-habilitados') {
      if (req.method() === 'GET') return route.fulfill({ json: catalog });
      const body = req.postDataJSON() as { convenios: number[] };
      expect(Object.keys(body)).toEqual(['convenios']);
      state.writes.push({ method: 'POST', ids: body.convenios });
      if (state.fail) {
        catalog[0].agregado = true;
        catalog[0].habilitado = true;
        return route.fulfill({
          status: 409,
          json: {
            detail:
              'Uno o más convenios ya fueron agregados. Actualice el listado.',
          },
        });
      }
      if (state.blocked)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      for (const row of catalog.filter((c) => body.convenios.includes(c.id))) {
        row.agregado = true;
        row.habilitado = true;
      }
      return route.fulfill({ json: true });
    }
    const match = path.match(
      /^\/api\/configuracion\/convenios-habilitados\/(\d+)$/,
    );
    if (match && req.method() === 'PUT') {
      const id = Number(match[1]);
      const body = req.postDataJSON() as { habilitado: boolean };
      expect(Object.keys(body)).toEqual(['habilitado']);
      state.writes.push({ method: 'PUT', ids: [id] });
      catalog.find((c) => c.id === id)!.habilitado = body.habilitado;
      return route.fulfill({ json: true });
    }
    throw new Error(`Unexpected ${req.method()} ${path}`);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Test123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app$/);
  return state;
}

test('convenios del tenant: menú principal, búsqueda, alta múltiple y deshabilitar sin eliminar', async ({
  page,
}, info) => {
  const state = await prepare(page);
  if (info.project.name === 'mobile')
    await page.locator('.sidebar-toggle').click();
  const link = page.getByRole('link', {
    name: 'Convenios habilitados',
    exact: true,
  });
  await expect(link.locator('..')).toHaveAttribute(
    'aria-label',
    'Navegación principal',
  );
  await link.click();
  await expect(page.getByText('No hay convenios agregados.')).toBeVisible();
  await expect(
    page.getByText('Primero seleccioná una empresa', { exact: false }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Agregar convenios',
    exact: true,
  });
  const search = dialog.getByRole('searchbox', {
    name: 'Buscar en Convenios disponibles',
  });
  await search.fill('Comercio');
  await dialog
    .getByRole('checkbox', { name: 'Seleccionar fila 1', exact: true })
    .check();
  await search.fill('Construcción');
  await dialog
    .getByRole('checkbox', { name: 'Seleccionar fila 2', exact: true })
    .check();
  await search.clear();
  await expect(
    dialog.getByRole('checkbox', { name: 'Seleccionar fila 1', exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByRole('checkbox', { name: 'Seleccionar fila 2', exact: true }),
  ).toBeChecked();
  await dialog
    .getByRole('button', { name: 'Página siguiente', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Página anterior', exact: true })
    .click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Seleccionar fila 1', exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: info.outputPath('agregar-convenios.png'),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .include('dialog')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  state.fail = true;
  await dialog
    .getByRole('button', { name: 'Agregar seleccionados', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('ya fueron agregados');
  await expect(
    dialog.getByRole('checkbox', { name: 'Seleccionar fila 1', exact: true }),
  ).toBeChecked();
  await dialog
    .getByRole('button', { name: 'Actualizar convenios', exact: true })
    .click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Seleccionar fila 1', exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('checkbox', { name: 'Seleccionar fila 2', exact: true }),
  ).toBeChecked();
  state.fail = false;
  state.blocked = true;
  await dialog
    .getByRole('button', { name: 'Agregar seleccionados', exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(2);
  await expect(
    dialog.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeDisabled();
  state.release();
  await expect(dialog).toHaveCount(0);
  expect([...state.writes[1]!.ids].sort()).toEqual([2]);
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Comercio', exact: true }) });
  await row.getByRole('button', { name: 'Deshabilitar', exact: true }).click();
  await expect(
    row.getByRole('cell', { name: 'Deshabilitado', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  await expect(
    row.getByRole('cell', { name: 'Deshabilitado', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('convenios-habilitados.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await search.fill('Comercio');
  await expect(
    dialog.getByText('No hay resultados para los filtros actuales.'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await row.getByRole('button', { name: 'Habilitar', exact: true }).click();
  await expect(
    row.getByRole('cell', { name: 'Habilitado', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Eliminar', exact: true }),
  ).toHaveCount(0);
});

test('consulta de convenios sin permiso de escritura', async ({
  page,
}, info) => {
  const state = await prepare(page, false);
  if (info.project.name === 'mobile')
    await page.locator('.sidebar-toggle').click();
  await page
    .getByRole('link', { name: 'Convenios habilitados', exact: true })
    .click();
  await expect(
    page.getByRole('cell', { name: 'Comercio', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Agregar', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Deshabilitar', exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
