import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';

test.setTimeout(90_000);
test('el superusuario filtra por tenant sin cambiar permisos y limpia la empresa al cambiar', async ({
  page,
}, info) => {
  const writes: string[] = [];
  let catalogCalls = 0;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const tenant = request.headers()['x-liquidar-tenant-id'];
    if (path === '/api/auth/login')
      return route.fulfill({ json: loginResponse({ isSuperAdmin: true }) });
    if (path === '/api/users/me') {
      expect(tenant).toBeUndefined();
      return route.fulfill({
        json: {
          actor: {
            userId: 7,
            tenantId: 7,
            applicationId: 42,
            isSuperAdmin: true,
            permissions: [],
          },
        },
      });
    }
    if (path === '/api/contexto/tenants') {
      expect(tenant).toBeUndefined();
      catalogCalls++;
      return route.fulfill({
        json: [
          { id: 2, name: 'Cliente dos' },
          { id: 3, name: 'Cliente tres' },
        ],
      });
    }
    if (path === '/api/configuracion/formulas-empresa')
      return route.fulfill({
        json: {
          enabled: true,
          puedeLeer: true,
          puedeEscribir: true,
          puedeEscribirCentral: true,
        },
      });
    if (path === '/api/liquidaciones/capacidades')
      return route.fulfill({
        json: { leer: false, generar: false, corregirNovedades: false },
      });
    if (path === '/api/configuracion/convenios-habilitados') {
      expect(['2', '3']).toContain(tenant);
      return route.fulfill({
        json: [
          {
            id: 10,
            nombre: `Convenio tenant ${tenant}`,
            agregado: true,
            habilitado: !writes.includes(tenant!),
          },
        ],
      });
    }
    if (
      path === '/api/configuracion/convenios-habilitados/10' &&
      request.method() === 'PUT'
    ) {
      expect(tenant).toBe('2');
      writes.push(tenant!);
      return route.fulfill({ json: true });
    }
    if (path === '/api/empresas/selector') {
      expect(['2', '3']).toContain(tenant);
      return route.fulfill({
        json: {
          items: [
            {
              id: Number(tenant) * 11,
              codigo: Number(tenant),
              nombre: tenant === '2' ? 'Empresa dos' : 'Empresa tres',
              claveUnica: null,
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        },
      });
    }
    if (path === '/api/empresas/22/completa') {
      expect(tenant).toBe('2');
      return route.fulfill({
        json: { empresa: { id: 22, nombre: 'Empresa dos' } },
      });
    }
    throw new Error(`Unexpected ${request.method()} ${path}`);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Test123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app$/);
  if (info.project.name === 'mobile')
    await page.locator('.sidebar-toggle').click();
  await page
    .getByRole('link', { name: 'Convenios habilitados', exact: true })
    .click();
  await expect(
    page.getByText(
      'Seleccioná un tenant desde el menú superior para administrar sus convenios habilitados.',
    ),
  ).toBeVisible();
  const tenantButton = page.getByRole('button', { name: /^Tenant:/ });
  const companyButton = page.locator(
    '.empresa-global:not(.tenant-global) > button',
  );
  const tenantBox = await tenantButton.boundingBox();
  const companyBox = await companyButton.boundingBox();
  expect(tenantBox!.y <= companyBox!.y).toBeTruthy();
  await tenantButton.click();
  await expect(
    page.getByRole('searchbox', { name: 'Buscar tenant' }),
  ).toBeFocused();
  await page.getByRole('searchbox', { name: 'Buscar tenant' }).fill('dos');
  await page.getByRole('button', { name: /Cliente dos Tenant 2/ }).click();
  await expect(
    page.getByRole('cell', { name: 'Convenio tenant 2', exact: true }),
  ).toBeVisible();
  // With no explicit permissions, write actions are still available through SuperAdmin.
  await page.getByRole('button', { name: 'Deshabilitar', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Deshabilitado', exact: true }),
  ).toBeVisible();
  await companyButton.click();
  await page.getByRole('button', { name: /Empresa dos Código/ }).click();
  await expect(companyButton).toContainText('Empresa dos');
  await tenantButton.click();
  await page.getByRole('button', { name: /Cliente tres Tenant 3/ }).click();
  await expect(companyButton).toContainText('Seleccionar empresa');
  await expect(
    page.getByRole('cell', { name: 'Convenio tenant 3', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Convenio tenant 2', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Agregar', exact: true }),
  ).toBeVisible();
  await companyButton.click();
  await expect(
    page.getByRole('button', { name: /Empresa tres Código/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Empresa dos Código/ }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await tenantButton.click();
  await page.screenshot({
    path: info.outputPath('selector-tenant.png'),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .include('header')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole('button', { name: 'Todos los tenants', exact: true })
    .click();
  await expect(tenantButton).toHaveAccessibleName('Tenant: Todos los tenants');
  await expect(companyButton).toContainText('Seleccionar empresa');
  await expect(
    page.getByText(
      'Seleccioná un tenant desde el menú superior para administrar sus convenios habilitados.',
    ),
  ).toBeVisible();
  expect(writes).toEqual(['2']);
  expect(catalogCalls).toBeGreaterThan(1);
});
