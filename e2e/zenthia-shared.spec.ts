import { test, expect } from '@playwright/test';
import { loginResponse } from '../src/test/fixtures';
import {
  initialFields,
  toWrite,
} from '../src/features/obras-sociales/schemas/obraSocialSchema';

test('el shell y los componentes compartidos conservan LiquidAR', async ({
  page,
}, info) => {
  const unexpected: string[] = [];
  const row = {
    ...toWrite(initialFields()),
    id: 1,
    nombre: 'Obra social de prueba',
    localidad: 'Rosario',
    provinciaNombre: null,
  };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/login')
      return route.fulfill({ json: loginResponse() });
    if (path === '/api/users/me')
      return route.fulfill({
        json: {
          user: { firstName: 'Ana', lastName: 'Prueba' },
          actor: {
            userId: 7,
            tenantId: 2,
            applicationId: 42,
            isSuperAdmin: false,
            permissions: ['obrassociales:read', 'obrassociales:write'],
          },
        },
      });
    if (path === '/api/liquidaciones/capacidades')
      return route.fulfill({
        json: { leer: false, generar: false, corregirNovedades: false },
      });
    if (path === '/api/configuracion/formulas-empresa')
      return route.fulfill({
        json: {
          enabled: false,
          puedeLeer: false,
          puedeEscribir: false,
          puedeEscribirCentral: false,
        },
      });
    if (path === '/api/obras-sociales')
      return route.fulfill({
        json: { items: [row], total: 1, page: 1, pageSize: 25 },
      });
    if (path === '/api/obras-sociales/provincias')
      return route.fulfill({ json: [] });
    unexpected.push(path);
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  const focusedInput = page.getByLabel('Usuario o email');
  await focusedInput.focus();
  const focusStyle = await focusedInput.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      outline: style.outlineWidth,
      border: style.borderColor,
      width: style.borderTopWidth,
      shadow: style.boxShadow,
    };
  });
  expect(focusStyle).toEqual({
    outline: '0px',
    border: 'rgb(184, 64, 42)',
    width: '1px',
    shadow: 'none',
  });
  await page.screenshot({
    path: info.outputPath('liquidar-shared-login-focus.png'),
    fullPage: true,
  });
  await page.getByLabel('Contraseña', { exact: true }).fill('FixturePassword1');
  await page.getByRole('button', { name: 'Ingresar →', exact: true }).click();
  await expect(page.getByLabel('Zenthia.LiquidAR.Web')).toBeVisible();
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Obras Sociales', exact: true })
    .click();
  await expect(page.getByText(row.nombre, { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('liquidar-shared-list.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('liquidar-shared-form.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(unexpected).toEqual([]);
});
