import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import type { Banco } from '../src/features/bancos/types/banco';

test.setTimeout(90000);

test('Bancos: ABM, destinos de guardado, skeleton y resultados BCRA', async ({
  page,
}, info) => {
  let rows: Banco[] = [
    {
      id: 1,
      codigoEntidad: 11,
      denominacion: 'Banco inicial',
      abreviacion: 'BI',
    },
  ];
  let nextId = 2;
  let importCalls = 0;
  const writes: string[] = [];
  let releaseList!: () => void;
  let releaseDetail!: () => void;
  const listGate = new Promise<void>((resolve) => {
    releaseList = resolve;
  });
  const detailGate = new Promise<void>((resolve) => {
    releaseDetail = resolve;
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
            permissions: ['bancos:read', 'bancos:write', 'bancos:delete'],
          },
        },
      });
    if (!path.startsWith('/api/bancos'))
      throw new Error('Ruta inesperada: ' + path);
    expect(request.headers().authorization).toBe('Bearer test-only-access');
    if (path === '/api/bancos/actualizar-desde-bcra') {
      expect(request.method()).toBe('POST');
      expect(request.postData()).toBeNull();
      importCalls++;
      if (importCalls === 1) {
        rows.push({
          id: nextId++,
          codigoEntidad: 99,
          denominacion: 'Incorporado desde BCRA',
          abreviacion: '',
        });
        return route.fulfill({
          status: 409,
          json: {
            title:
              'La actualización desde BCRA tuvo errores; los registros incorporados permanecen guardados.',
            resultado: {
              incorporados: 1,
              omitidos: 2,
              fallidos: [
                {
                  codigoEntidad: 44,
                  motivo: 'No se pudo incorporar el banco.',
                },
              ],
            },
          },
        });
      }
      if (importCalls === 2)
        return route.fulfill({
          status: 502,
          json: { title: 'No se pudo obtener el catálogo de bancos del BCRA.' },
        });
      return route.fulfill({
        json: { incorporados: 0, omitidos: rows.length, fallidos: [] },
      });
    }
    if (path === '/api/bancos' && request.method() === 'GET') {
      expect(url.search).toBe('?page=1&pageSize=25');
      await listGate;
      return route.fulfill({
        json: { items: rows, total: rows.length, page: 1, pageSize: 25 },
      });
    }
    if (request.method() === 'POST' || request.method() === 'PUT') {
      const data = request.postDataJSON();
      expect(Object.keys(data).sort()).toEqual([
        'abreviacion',
        'codigoEntidad',
        'denominacion',
      ]);
      writes.push(request.method() + ' ' + path);
      const id =
        request.method() === 'POST' ? nextId++ : Number(path.split('/').pop());
      const row: Banco = { ...data, id };
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
    const row = rows.find((row) => path === '/api/bancos/' + row.id);
    if (request.method() === 'GET' && row) {
      await detailGate;
      return route.fulfill({ json: row });
    }
    throw new Error('Ruta inesperada: ' + path);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('link', { name: 'Bancos', exact: true }).click();
  await expect(page.locator('.skeleton-grid-row')).toHaveCount(5);
  const borders = await page.locator('.data-grid th').evaluateAll((headers) =>
    headers.map((header) => {
      const css = getComputedStyle(header);
      return [css.borderTop, css.borderBottom];
    }),
  );
  for (const [top, bottom] of borders) expect(top).toBe(bottom);
  await page.screenshot({
    path: info.outputPath('bancos-loading.png'),
    fullPage: true,
  });
  releaseList();
  await expect(page.getByText('Banco inicial', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(5);
  await expect(page.getByRole('searchbox')).toBeDisabled();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.locator('.banco-form-skeleton')).toBeVisible();
  const before = await page.locator('.banco-fields').boundingBox();
  await page.screenshot({
    path: info.outputPath('banco-skeleton.png'),
    fullPage: true,
  });
  releaseDetail();
  await expect(page.getByLabel('Denominación', { exact: true })).toHaveValue(
    'Banco inicial',
  );
  const after = await page.locator('.banco-fields').boundingBox();
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
  await page.getByLabel('Denominación', { exact: true }).fill('Descartar');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByLabel('Denominación', { exact: true })).toHaveValue(
    'Banco inicial',
  );
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel('Código', { exact: true }).fill('-2');
  await page.getByLabel('Denominación', { exact: true }).fill('Banco nuevo');
  await page.getByLabel('Abreviación', { exact: true }).fill('BN');
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
    path: info.outputPath('banco-form.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Editar banco' }),
  ).toBeVisible();
  await expect(page.getByLabel('Denominación', { exact: true })).toHaveValue(
    'Banco nuevo',
  );
  await page
    .getByLabel('Denominación', { exact: true })
    .fill('Banco actualizado');
  await page.getByRole('button', { name: 'Guardar y nuevo' }).click();
  await expect(page.getByRole('dialog', { name: 'Nuevo banco' })).toBeVisible();
  await expect(page.getByLabel('Código', { exact: true })).toHaveValue('0');
  await expect(page.getByLabel('Denominación', { exact: true })).toHaveValue(
    '',
  );
  expect(writes).toEqual(['POST /api/bancos', 'PUT /api/bancos/2']);
  await page.getByLabel('Denominación', { exact: true }).fill('Otro banco');
  await page.getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver', exact: true }).first().click();
  await expect(
    page.getByLabel('Denominación', { exact: true }),
  ).toHaveAttribute('readonly');
  await page.keyboard.press('Escape');
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
    page.getByRole('cell', { name: 'Otro banco', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Actualizar desde BCRA' }).click();
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(
    page.getByText(/Incorporados: 1. Omitidos: 2. Fallidos: 1/),
  ).toBeVisible();
  await expect(
    page.getByText('Código 44: No se pudo incorporar el banco.'),
  ).toBeVisible();
  expect(importCalls).toBe(1);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath('bcra-parcial.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Incorporado desde BCRA', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar desde BCRA' }).click();
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(
    page.getByText('No se pudo obtener el catálogo de bancos del BCRA.'),
  ).toBeVisible();
  await expect(page.getByText(/Incorporados:/)).toHaveCount(0);
  expect(importCalls).toBe(2);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Actualizar desde BCRA' }).click();
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(
    page.getByText(/Actualización completada. Incorporados: 0/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  expect(importCalls).toBe(3);
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
    path: info.outputPath('bancos.png'),
    fullPage: true,
  });
});

test('Bancos: lectura sin escritura y bloqueo de acceso sin permiso', async ({
  page,
}, info) => {
  let permissions = ['bancos:read'];
  const bankRequests: string[] = [];
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
            permissions,
          },
        },
      });
    if (path === '/api/bancos') {
      bankRequests.push(path);
      return route.fulfill({
        json: {
          items: [
            {
              id: 1,
              codigoEntidad: 0,
              denominacion: 'Consulta',
              abreviacion: null,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
        },
      });
    }
    return route.fulfill({ status: 401, json: {} });
  });
  const login = async () => {
    await page.goto('/login');
    await page.getByLabel('Usuario o email').fill('ana');
    await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
    await page.getByRole('button', { name: 'Ingresar →' }).click();
    await expect(page).toHaveURL(/\/app/);
    if (info.project.name === 'mobile')
      await page.getByRole('button', { name: 'Menú' }).click();
  };
  await login();
  await page.getByRole('link', { name: 'Bancos', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Consulta', exact: true }),
  ).toBeVisible();
  for (const name of ['Nuevo', 'Editar', 'Eliminar', 'Actualizar desde BCRA'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
      0,
    );
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  await expect(
    page.getByLabel('Denominación', { exact: true }),
  ).toHaveAttribute('readonly');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  permissions = ['bancos:write'];
  bankRequests.length = 0;
  await page.evaluate(() => sessionStorage.clear());
  await login();
  await expect(
    page.getByRole('link', { name: 'Bancos', exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    history.pushState({}, '', '/app/bancos');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(
    page.getByText('No tenés permiso para consultar bancos.'),
  ).toBeVisible();
  expect(bankRequests).toEqual([]);
});
