import { test, expect } from '@playwright/test';
import { loginResponse } from '../src/test/fixtures';

test.setTimeout(180000);
test('agrupación por empresa: formulario y acciones accesibles en cada tamaño', async ({
  page,
}, info) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/login')
      return route.fulfill({ json: loginResponse() });
    if (path === '/api/auth/refresh')
      return route.fulfill({ status: 401, json: {} });
    if (path === '/api/users/me')
      return route.fulfill({
        json: {
          actor: {
            userId: 7,
            tenantId: 2,
            applicationId: 42,
            isSuperAdmin: false,
            roles: ['TenantAdmin'],
            permissions: ['formulas:read', 'formulas:write'],
          },
        },
      });
    if (path === '/api/configuracion/formulas-empresa')
      return route.fulfill({
        json: {
          enabled: true,
          puedeLeer: true,
          puedeEscribir: true,
          puedeEscribirCentral: false,
        },
      });
    if (path === '/api/configuracion/formulas-empresa/empresas/10')
      return route.fulfill({
        json: {
          id: 10,
          codigo: 1,
          nombre: 'Empresa de prueba',
          claveUnica: 'CUIT de prueba',
        },
      });
    if (path === '/api/liquidaciones/capacidades')
      return route.fulfill({
        json: { leer: false, generar: false, corregirNovedades: false },
      });
    if (path === '/api/configuracion/formulas-empresa/empresas')
      return route.fulfill({
        json: {
          items: [
            {
              id: 10,
              codigo: 1,
              nombre: 'Empresa de prueba',
              claveUnica: 'CUIT de prueba',
              telefono: null,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
        },
      });
    if (path.endsWith('/agrupaciones-formulas/formulas'))
      return route.fulfill({
        json: [
          {
            id: 1,
            codigo: 1,
            descripcion: 'No remunerativo A',
            convenioId: 3,
            columna: 2,
            idEmpresa: null,
          },
          {
            id: 2,
            codigo: 2,
            descripcion: 'No remunerativo B',
            convenioId: 3,
            columna: 2,
            idEmpresa: null,
          },
        ],
      });
    if (path.endsWith('/catalogos'))
      return route.fulfill({
        json: {
          convenios: [],
          conceptos: [],
          unidades: [],
          meses: [],
          tiposLiquidacion: [],
        },
      });
    return route.fulfill({ json: [] });
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const menu = page.getByRole('button', { name: 'Menú', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Empresas', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Empresas', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Configuración de Fórmulas', exact: true })
    .click();
  await expect(page).toHaveURL(/empresas\/configuracion-formulas$/);
  await expect(
    page.getByText(
      'Seleccioná una empresa desde el menú superior para configurar sus fórmulas y recibo.',
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Seleccionar empresa', exact: true })
    .click();
  await page.getByRole('button', { name: /Empresa de prueba.*Código/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Configuración de Fórmulas' }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('configuracion-formulas.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Nueva agrupación' });
  await expect(editor).toBeVisible();
  await expect(page.locator('.empresa-global-trigger')).toBeDisabled();
  await editor
    .getByLabel('Descripción en el recibo')
    .fill('No remunerativo unificado');
  await editor.getByRole('checkbox', { name: /1 · No remunerativo A/ }).check();
  await editor.getByRole('checkbox', { name: /2 · No remunerativo B/ }).check();
  await expect(
    editor.getByRole('button', { name: 'Guardar y cerrar' }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('agrupacion.png'),
    fullPage: true,
  });
  await editor.getByRole('button', { name: 'Cancelar' }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.locator('.empresa-global-trigger')).toBeEnabled();
});
