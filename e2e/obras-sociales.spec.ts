import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import {
  initialFields,
  toWrite,
} from '../src/features/obras-sociales/schemas/obraSocialSchema';
import type { ObraSocial } from '../src/features/obras-sociales/types/obraSocial';

test.setTimeout(90000);

test('ABM, modos de guardado, skeleton y formulario responsive', async ({
  page,
}, info) => {
  let rows: ObraSocial[] = [
    {
      ...toWrite(initialFields()),
      id: 1,
      nombre: 'OS Comercio',
      localidad: 'Rosario',
      provinciaNombre: null,
    },
  ];
  let nextId = 2;
  const writes: {
    method: string;
    path: string;
    data: Record<string, unknown>;
  }[] = [];
  const queries: string[] = [];
  let releaseList!: () => void;
  let releaseProvincias!: () => void;
  const listGate = new Promise<void>((resolve) => {
    releaseList = resolve;
  });
  const provinceGate = new Promise<void>((resolve) => {
    releaseProvincias = resolve;
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
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
            permissions: [
              'obrassociales:read',
              'obrassociales:write',
              'obrassociales:delete',
            ],
          },
        },
      });
    if (!path.startsWith('/api/obras-sociales'))
      throw new Error('Ruta inesperada: ' + path);
    expect(request.headers().authorization).toBe('Bearer test-only-access');
    if (path === '/api/obras-sociales/provincias') {
      await provinceGate;
      return route.fulfill({ json: [{ id: 1, nombre: 'Buenos Aires' }] });
    }
    if (path === '/api/obras-sociales' && request.method() === 'GET') {
      queries.push(url.search);
      await listGate;
      return route.fulfill({
        json: { items: rows, total: rows.length, page: 1, pageSize: 25 },
      });
    }
    if (request.method() === 'POST' || request.method() === 'PUT') {
      const data = request.postDataJSON();
      writes.push({ method: request.method(), path, data });
      expect(Object.keys(data)).toHaveLength(12);
      for (const key of ['id', 'localidad', 'tenantId', 'applicationId'])
        expect(data).not.toHaveProperty(key);
      const id =
        request.method() === 'POST' ? nextId++ : Number(path.split('/').pop());
      const row: ObraSocial = {
        ...data,
        id,
        localidad: rows.find((r) => r.id === id)?.localidad ?? null,
        provinciaNombre: data.idProvincia === 1 ? 'Buenos Aires' : null,
      };
      rows =
        request.method() === 'POST'
          ? [...rows, row]
          : rows.map((old) => (old.id === id ? row : old));
      return route.fulfill({
        status: request.method() === 'POST' ? 201 : 200,
        json: row,
      });
    }
    if (request.method() === 'DELETE') {
      rows = rows.filter((row) => !path.endsWith('/' + row.id));
      return route.fulfill({ status: 204 });
    }
    const row = rows.find((row) => path === '/api/obras-sociales/' + row.id);
    if (request.method() === 'GET' && row) return route.fulfill({ json: row });
    throw new Error('Ruta inesperada: ' + path);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('link', { name: 'Obras Sociales', exact: true }).click();
  await expect(page.locator('.skeleton-grid-row')).toHaveCount(5);
  const headerBorders = () =>
    page.locator('.data-grid th').evaluateAll((headers) =>
      headers.map((header) => {
        const style = getComputedStyle(header);
        return {
          top: [
            style.borderTopWidth,
            style.borderTopStyle,
            style.borderTopColor,
          ],
          bottom: [
            style.borderBottomWidth,
            style.borderBottomStyle,
            style.borderBottomColor,
          ],
        };
      }),
    );
  const loadingBorders = await headerBorders();
  expect(loadingBorders.length).toBeGreaterThan(0);
  for (const border of loadingBorders) {
    expect(border.top).toEqual(border.bottom);
    expect(border.top.slice(0, 2)).toEqual(['1px', 'solid']);
  }
  await page.screenshot({
    path: info.outputPath('obras-sociales-loading.png'),
    fullPage: true,
  });
  releaseList();
  await expect(page.getByText('OS Comercio', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(6);
  for (const name of ['Código', 'Nombre', 'Email', 'Teléfono', 'Acciones']) {
    await expect(
      page.getByRole('columnheader', { name: new RegExp('^' + name) }),
    ).toHaveCount(1);
  }
  expect(await headerBorders()).toEqual(loadingBorders);
  expect(queries[0]).toBe('?page=1&pageSize=25');
  await expect(page.getByRole('searchbox')).toBeDisabled();
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await expect(page.locator('.obra-social-form-skeleton')).toBeVisible();
  const skeletonBounds = await page
    .locator('.obra-social-fields')
    .boundingBox();
  await expect(
    page.getByRole('button', { name: 'Guardar y cerrar' }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath('obra-social-skeleton.png'),
    fullPage: true,
  });
  releaseProvincias();
  await expect(page.getByLabel('Nombre', { exact: true })).toBeVisible();
  const formBounds = await page.locator('.obra-social-fields').boundingBox();
  expect(
    Math.abs(formBounds!.height - skeletonBounds!.height),
  ).toBeLessThanOrEqual(1);
  await expect(page.getByLabel('Localidad')).toHaveCount(0);
  await page.getByLabel('Nombre', { exact: true }).fill('Nueva OS');
  await page
    .getByLabel('Importe de aporte', { exact: true })
    .fill('999999999999999.9999');
  await page.getByLabel('Provincia', { exact: true }).selectOption('1');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('obra-social-form.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Editar obra social' }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Nueva OS',
  );
  expect(writes[0]?.data.importeAporte).toBe('999999999999999.9999');
  await page.getByLabel('Nombre', { exact: true }).fill('OS actualizada');
  await page.getByRole('button', { name: 'Guardar y nuevo' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Nueva obra social' }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('');
  expect(writes[1]?.method).toBe('PUT');
  expect(writes[1]?.path).toBe('/api/obras-sociales/2');
  await page.getByLabel('Nombre', { exact: true }).fill('Otra OS');
  await page.getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('cell', { name: 'Otra OS', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ver', exact: true }).first().click();
  await expect(page.getByLabel('Localidad')).toHaveValue('Rosario');
  await expect(page.getByLabel('Localidad')).toHaveAttribute('readonly');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Eliminar', exact: true })
    .last()
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Eliminar', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('cell', { name: 'Otra OS', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath('obras-sociales.png'),
    fullPage: true,
  });
});

test('sin lectura oculta el enlace y bloquea acceso directo sin consultar LiquidAR', async ({
  page,
}, info) => {
  const liquidarRequests: string[] = [];
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
            permissions: ['obrassociales:write'],
          },
        },
      });
    if (path.startsWith('/api/obras-sociales')) liquidarRequests.push(path);
    return route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app/);
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Menú' }).click();
  await expect(
    page.getByRole('link', { name: 'Obras Sociales', exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    history.pushState({}, '', '/app/obras-sociales');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(
    page.getByText('No tenés permiso para consultar obras sociales.'),
  ).toBeVisible();
  expect(liquidarRequests).toEqual([]);
});
