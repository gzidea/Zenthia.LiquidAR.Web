import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.setTimeout(60000);
import { loginResponse } from '../src/test/fixtures';
import {
  initialFields,
  toWrite,
} from '../src/features/sindicatos/schemas/sindicatoSchema';

test('Sindicatos: skeleton, bordes del header y estabilidad del modal', async ({
  page,
}, info) => {
  const row = {
    ...toWrite(initialFields()),
    id: 1,
    nombre: 'Comercio',
    provinciaNombre: null,
  };
  let releaseList!: () => void;
  let releaseForm!: () => void;
  const listReady = new Promise<void>((resolve) => {
    releaseList = resolve;
  });
  const formReady = new Promise<void>((resolve) => {
    releaseForm = resolve;
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
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
            permissions: ['sindicatos:read', 'sindicatos:write'],
          },
        },
      });
    if (path === '/api/sindicatos') {
      await listReady;
      return route.fulfill({
        json: { items: [row], total: 1, page: 1, pageSize: 25 },
      });
    }
    if (path === '/api/provincias' || path === '/api/sindicatos/1') {
      await formReady;
      return route.fulfill({ json: path === '/api/provincias' ? [] : row });
    }
    throw new Error('Ruta inesperada: ' + path);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('link', { name: 'Sindicatos', exact: true }).click();
  const grid = page.locator('.data-grid');
  await expect(grid).toBeVisible({ timeout: 15000 });
  await expect(grid.locator('.skeleton-grid-row')).toHaveCount(5);
  const checkBorders = async () => {
    const borders = await grid.locator('th').evaluateAll((elements) =>
      elements.map((element) => {
        const css = getComputedStyle(element);
        return {
          top: [css.borderTopWidth, css.borderTopStyle, css.borderTopColor],
          bottom: [
            css.borderBottomWidth,
            css.borderBottomStyle,
            css.borderBottomColor,
          ],
        };
      }),
    );
    expect(borders.length).toBeGreaterThan(0);
    for (const border of borders) {
      expect(border.top).toEqual(border.bottom);
      expect(border.top.slice(0, 2)).toEqual(['1px', 'solid']);
    }
  };
  await checkBorders();
  await page.screenshot({
    path: info.outputPath('sindicatos-loading.png'),
    fullPage: true,
  });
  releaseList();
  await expect(
    page.getByRole('cell', { name: 'Comercio', exact: true }),
  ).toBeVisible();
  await expect(grid.locator('.skeleton-grid-row')).toHaveCount(0);
  await checkBorders();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar sindicato' });
  await expect(dialog.locator('.sindicato-form-skeleton')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Guardar y cerrar', exact: true }),
  ).toBeDisabled();
  await expect(dialog.locator('input,select')).toHaveCount(0);
  const before = await dialog.boundingBox();
  await page.screenshot({
    path: info.outputPath('sindicato-form-loading.png'),
  });
  releaseForm();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Comercio',
  );
  await expect(dialog.locator('.sindicato-form-skeleton')).toHaveCount(0);
  const after = await dialog.boundingBox();
  expect(after!.width).toBe(before!.width);
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(4);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
