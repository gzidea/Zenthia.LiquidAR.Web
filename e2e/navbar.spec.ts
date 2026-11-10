import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';

test('navbar: búsqueda remota, páginas, selección, iniciales y logout', async ({
  page,
}, info) => {
  let logout = false;
  const searches: string[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/auth/login')
      return route.fulfill({ json: loginResponse() });
    if (path === '/api/users/me')
      return route.fulfill({
        json: {
          user: { firstName: 'Gustavo', lastName: 'Gómez' },
          actor: {
            userId: 7,
            tenantId: 2,
            applicationId: 42,
            isSuperAdmin: false,
            permissions: ['empresas:read'],
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
    if (path === '/api/empresas/selector') {
      const buscar = url.searchParams.get('buscar') || '';
      const current = Number(url.searchParams.get('page'));
      searches.push(`${buscar}:${current}`);
      const id = buscar ? 77 : current === 2 ? 26 : 1;
      return route.fulfill({
        json: {
          items: [
            {
              id,
              codigo: id,
              nombre: buscar ? 'Empresa buscada' : `Empresa ${id}`,
              claveUnica: '30-00000000-1',
            },
          ],
          page: current,
          pageSize: 25,
          total: buscar ? 1 : 26,
        },
      });
    }
    if (path === '/api/empresas/77/completa')
      return route.fulfill({
        json: {
          empresa: { id: 77, nombre: 'Empresa buscada' },
          contactos: [],
          actividades: [],
          bancos: [],
        },
      });
    if (path === '/api/auth/revoke') {
      logout = true;
      return route.fulfill({ status: 204 });
    }
    throw new Error(`Unexpected ${path}`);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('gustavo');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const mobile = info.project.name === 'mobile';
  const sidebar = page.locator('#app-sidebar');
  const toggle = page.locator('.sidebar-toggle');
  if (mobile) await toggle.click();
  await expect(sidebar).toBeVisible();
  await expect(
    sidebar.getByRole('button', { name: 'Configuración', exact: true }),
  ).toHaveCount(0);
  await expect(
    sidebar.getByRole('button', { name: 'Cerrar sesión', exact: true }),
  ).toBeDisabled();
  await expect(
    sidebar.getByRole('link', { name: 'Inicio', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.screenshot({
    path: info.outputPath('sidebar-expanded.png'),
    fullPage: true,
  });
  if (mobile) {
    await sidebar.getByRole('link', { name: 'Inicio', exact: true }).click();
    await expect(sidebar).not.toBeVisible();
    await toggle.click();
  }
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  if (mobile) await expect(sidebar).not.toBeVisible();
  else {
    await expect(sidebar).toHaveCSS('width', '80px');
    await sidebar.getByRole('link', { name: 'Inicio', exact: true }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  }
  await page.screenshot({
    path: info.outputPath('sidebar-collapsed.png'),
    fullPage: true,
  });
  await expect(page.locator('.empresa-global-trigger')).toHaveCSS(
    'color',
    'rgb(184, 64, 42)',
  );
  await page.screenshot({
    path: info.outputPath('navbar-sin-empresa.png'),
    fullPage: true,
  });
  await expect(page.getByLabel('Gustavo Gómez', { exact: true })).toHaveText(
    'GG',
  );
  await page.getByRole('button', { name: 'Seleccionar empresa' }).click();
  await expect(
    page.getByRole('button', { name: /Empresa 1 Código/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(
    page.getByRole('button', { name: /Empresa 26 Código/ }),
  ).toBeVisible();
  await page.getByLabel('Buscar empresa').fill('buscada');
  await page.getByRole('button', { name: /Empresa buscada Código/ }).click();
  await expect(
    page.getByRole('button', { name: /Empresa buscada/ }),
  ).toBeVisible();
  expect(searches).toContain('buscada:1');
  await expect(page.locator('.empresa-global-trigger')).toHaveCSS(
    'color',
    'rgb(28, 38, 32)',
  );
  await page.screenshot({
    path: info.outputPath('navbar.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: /Empresa buscada/ }).click();
  await page.screenshot({
    path: info.outputPath('navbar-selector.png'),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('region', { name: 'Selector de empresa' }),
  ).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator('.navbar')
    .getByRole('button', { name: 'Cerrar sesión', exact: true })
    .locator('svg')
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(logout).toBe(true);
});
