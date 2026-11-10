import { test, expect } from '@playwright/test';
test.setTimeout(90000);
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import {
  initialFields,
  toWrite,
} from '../src/features/sindicatos/schemas/sindicatoSchema';
test('ABM con permisos, contrato remoto, modal y accesibilidad', async ({
  page,
}, info) => {
  let rows = [
    {
      ...toWrite(initialFields()),
      id: 1,
      nombre: 'Comercio',
      provinciaNombre: null,
    },
  ];
  const listPages: string[] = [];
  const writes: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.startsWith('/api/sindicatos') || path === '/api/provincias') {
      expect(request.headers().authorization).toBe('Bearer test-only-access');
    }
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
            permissions: [
              'sindicatos:read',
              'sindicatos:write',
              'sindicatos:delete',
            ],
          },
        },
      });
    if (path === '/api/provincias')
      return route.fulfill({ json: [{ id: 1, nombre: 'Buenos Aires' }] });
    if (path === '/api/sindicatos' && request.method() === 'GET') {
      listPages.push(url.search);
      return route.fulfill({
        json: { items: rows, total: rows.length, page: 1, pageSize: 25 },
      });
    }
    if (path === '/api/sindicatos' && request.method() === 'POST') {
      writes.push('POST ' + path);
      const row = { ...request.postDataJSON(), id: 2, provinciaNombre: null };
      rows.push(row);
      return route.fulfill({ status: 201, json: row });
    }
    if (request.method() === 'GET')
      return route.fulfill({
        json: rows.find((row) => path.endsWith('/' + row.id)),
      });
    if (request.method() === 'PUT') {
      writes.push('PUT ' + path);
      const id = Number(path.split('/').pop());
      const row = { ...request.postDataJSON(), id, provinciaNombre: null };
      rows = rows.map((old) => (old.id === id ? row : old));
      return route.fulfill({ json: row });
    }
    if (request.method() === 'DELETE') {
      rows = rows.filter((row) => !path.endsWith('/' + row.id));
      return route.fulfill({ status: 204 });
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
  await expect(page.getByText('Comercio', { exact: true })).toBeVisible();
  expect(listPages[0]).toBe('?page=1&pageSize=25');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Nuevo');
  await page.getByLabel('Importe de aporte', { exact: true }).fill('123.4567');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath('sindicato-form.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Editar sindicato' }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Nuevo');
  await page.getByLabel('Nombre', { exact: true }).fill('Borrador');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Nuevo');
  await page
    .getByRole('button', { name: 'Guardar y nuevo', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Nuevo sindicato' }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('');
  expect(writes).toEqual(['POST /api/sindicatos', 'PUT /api/sindicatos/2']);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('cell', { name: 'Nuevo', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Editar', exact: true })
    .first()
    .click();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Comercio',
  );
  await page.getByLabel('Nombre', { exact: true }).fill('Comercio editado');
  await page
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByText('Comercio editado', { exact: true }),
  ).toBeVisible();
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
    page.getByRole('cell', { name: 'Nuevo', exact: true }),
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
    path: info.outputPath('sindicatos.png'),
    fullPage: true,
  });
});
