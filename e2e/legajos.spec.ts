import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import { emptyLegajo } from '../src/features/legajos/schemas/legajoSchema';
import type { Completo, Write } from '../src/features/legajos/types/legajo';
test.setTimeout(240000);
test.use({ actionTimeout: 15000 });
async function fixture(page: Page, write = true) {
  const records = new Map<number, Completo>();
  const writes: { method: string; data: Write }[] = [];
  let next = 1;
  let child = 1;
  let fail = false;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
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
            permissions: write
              ? ['legajo:read', 'legajo:write']
              : ['legajo:read'],
          },
        },
      });
    expect(req.headers().authorization).toBe('Bearer test-only-access');
    if (path.includes('/catalogos/')) {
      const kind = path.split('/').at(-1);
      const parent = url.searchParams.get('padreId');
      const catalogs: Record<string, { id: number; nombre: string }[]> = {
        empresas: [{ id: 1, nombre: 'Empresa de prueba' }],
        convenios: [{ id: 3, nombre: 'Comercio' }],
        categorias:
          parent === '3' ? [{ id: 4, nombre: 'Administrativo A' }] : [],
        actividades:
          parent === '1' ? [{ id: 5, nombre: 'Actividad de prueba' }] : [],
        formulas:
          parent === '3'
            ? Array.from({ length: 30 }, (_, i) => ({
                id: i + 1,
                nombre: `Concepto ${i + 1}`,
              }))
            : [],
        'tipos-liquidacion': [{ id: 1, nombre: 'Mensual' }],
        provincias: [{ id: 1, nombre: 'Santa Fe' }],
      };
      return route.fulfill({ json: catalogs[kind!] ?? [] });
    }
    if (path === '/api/legajos' && method === 'GET') {
      const search = (url.searchParams.get('buscar') ?? '').toLowerCase();
      const rows = [...records.values()]
        .map((x) => x.legajo)
        .filter((x) =>
          `${x.apellidos} ${x.nombres} ${x.legajo}`
            .toLowerCase()
            .includes(search),
        );
      return route.fulfill({
        json: { items: rows, total: rows.length, page: 1, pageSize: 25 },
      });
    }
    const id = Number(path.split('/')[3]);
    if (method === 'GET' && path.endsWith('/completo'))
      return route.fulfill({ json: records.get(id) });
    if (method === 'DELETE') {
      records.delete(id);
      return route.fulfill({ status: 204 });
    }
    if ((method === 'POST' || method === 'PUT') && path.endsWith('/completo')) {
      const data = req.postDataJSON() as Write;
      writes.push({ method, data });
      if (fail) {
        fail = false;
        return route.fulfill({
          status: 400,
          json: {
            title: 'Validación',
            errors: { 'legajo.cuil': ['Revisá el CUIL.'] },
          },
        });
      }
      const key = method === 'POST' ? next++ : id;
      const old = records.get(key);
      const changed = new Set(data.conceptos.map((x) => x.id));
      const saved: Completo = {
        legajo: {
          ...emptyLegajo,
          ...data.legajo,
          id: key,
          empresaNombre: 'Empresa de prueba',
          convenioNombre: 'Comercio',
          categoriaNombre: 'Administrativo A',
        },
        conceptos: [
          ...(old?.conceptos ?? []).filter(
            (x) =>
              !changed.has(x.id) && !data.conceptosEliminar.includes(x.id!),
          ),
          ...data.conceptos.map((x) => ({
            ...x.datos,
            id: x.id ?? child++,
            idLegajo: key,
          })),
        ],
        antiguedad: 'Años: 2 Meses: 1',
      };
      records.set(key, saved);
      return route.fulfill({
        status: method === 'POST' ? 201 : 200,
        json: saved,
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('tester');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('test-only-password');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app$/);
  if (await page.getByRole('button', { name: 'Menú', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await page.getByRole('link', { name: 'Legajos', exact: true }).click();
  return {
    records,
    writes,
    failNext: () => {
      fail = true;
    },
    seed: () => {
      records.set(next, {
        legajo: {
          ...emptyLegajo,
          id: next++,
          nombres: 'Ana',
          apellidos: 'Pérez',
          idConvenio: 3,
        },
        conceptos: [],
        antiguedad: '',
      });
    },
  };
}
test('guardados completos, conceptos, precisión y diseño', async ({
  page,
}, info) => {
  const state = await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Nuevo legajo', exact: true });
  await expect(dialog.getByLabel('Nombres', { exact: true })).toBeVisible();
  await dialog.getByLabel('Legajo', { exact: true }).fill('100');
  await dialog.getByLabel('Nombres', { exact: true }).fill('Ana');
  await dialog.getByLabel('Apellidos', { exact: true }).fill('Pérez');
  await dialog.getByLabel('Empresa', { exact: true }).selectOption('1');
  await dialog
    .getByLabel('Actividad de empresa', { exact: true })
    .selectOption('5');
  await dialog.getByLabel('Convenio', { exact: true }).selectOption('3');
  await dialog.getByLabel('Categoría', { exact: true }).selectOption('4');
  await dialog.getByLabel('Sueldo', { exact: true }).fill('1234567890123.4567');
  await dialog.getByRole('tab', { name: 'Conceptos particulares (0)' }).click();
  await dialog
    .getByRole('button', { name: 'Agregar conceptos', exact: true })
    .click();
  const selector = page.getByRole('dialog', {
    name: 'Agregar conceptos',
    exact: true,
  });
  await selector.getByLabel('Buscar conceptos').fill('Concepto 1');
  await selector
    .getByRole('row')
    .filter({ hasText: 'Concepto 1' })
    .first()
    .getByRole('checkbox')
    .check();
  await selector.getByLabel('Buscar conceptos').fill('Concepto 2');
  await selector
    .getByRole('row')
    .filter({ hasText: 'Concepto 2' })
    .first()
    .getByRole('checkbox')
    .check();
  await selector
    .getByRole('button', { name: 'Limpiar búsqueda', exact: true })
    .click();
  await expect(selector.getByLabel('Buscar conceptos')).toHaveValue('');
  await selector
    .getByRole('button', { name: 'Agregar seleccionados (2)' })
    .click();
  await expect(dialog.locator('.legajo-detail-card')).toHaveCount(2);
  await dialog
    .locator('.legajo-detail-card')
    .first()
    .getByRole('button', { name: 'Editar', exact: true })
    .click();
  const editor = page.getByRole('dialog', {
    name: 'Editar concepto particular',
  });
  await editor.getByLabel('Importe', { exact: true }).fill('900.1234');
  await editor.getByLabel('Tipo de liquidación').selectOption('1');
  await editor.getByRole('button', { name: 'Aplicar al borrador' }).click();
  expect(state.writes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Editar legajo', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Nombres', { exact: true })).toHaveValue(
    'Ana',
  );
  expect(state.writes[0]!.method).toBe('POST');
  expect(state.writes[0]!.data.legajo.sueldo).toBe('1234567890123.4567');
  expect(state.records.size).toBe(1);
  await dialog.getByRole('tab', { name: 'Conceptos particulares (2)' }).click();
  await expect(dialog.locator('.legajo-detail-card').first()).toHaveCSS(
    'border-top-width',
    '1px',
  );
  await dialog.locator('.legajo-detail-card').first().scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: info.outputPath('legajo-conceptos.png') });
  const violations = await new AxeBuilder({ page })
    .include('dialog[open]')
    .analyze();
  expect(violations.violations).toEqual([]);
  await dialog.getByRole('tab', { name: 'SICOSS', exact: true }).click();
  await dialog.getByLabel('Modalidad de contratación').scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: info.outputPath('legajo-sicoss.png') });
  await dialog
    .getByRole('tab', { name: 'Datos laborales', exact: true })
    .click();
  await dialog.getByLabel('Legajo', { exact: true }).scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: info.outputPath('legajo-form.png') });
  await dialog
    .getByRole('button', { name: 'Guardar y nuevo', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog', { name: 'Nuevo legajo', exact: true })
      .getByLabel('Nombres', { exact: true }),
  ).toHaveValue('');
  expect(state.writes.at(-1)!.method).toBe('PUT');
  expect(state.records.size).toBe(1);
  dialog = page.getByRole('dialog', { name: 'Nuevo legajo', exact: true });
  await dialog.getByLabel('Nombres', { exact: true }).fill('Beto');
  await dialog
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.records.size).toBe(2);
});
test('errores, deshacer, cancelación, consulta y bajas explícitas', async ({
  page,
}) => {
  const state = await fixture(page);
  state.seed();
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Editar legajo', exact: true });
  await dialog.getByLabel('Nombres', { exact: true }).fill('Borrador');
  state.failNext();
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog.getByText('Revisá el valor ingresado.')).toBeVisible();
  await expect(dialog.getByLabel('Nombres', { exact: true })).toHaveValue(
    'Borrador',
  );
  await dialog.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(dialog.getByLabel('Nombres', { exact: true })).toHaveValue(
    'Ana',
  );
  await dialog.getByLabel('Nombres', { exact: true }).fill('Cancelar');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Ver legajo', exact: true });
  await expect(dialog.getByLabel('Nombres', { exact: true })).toHaveValue(
    'Ana',
  );
  await expect(dialog.getByLabel('Nombres', { exact: true })).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Guardar', exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Confirmar eliminación' })
    .getByRole('button', { name: 'Eliminar', exact: true })
    .click();
  await expect(page.getByText('No hay legajos para mostrar.')).toBeVisible();
});
test('lectura sin escritura', async ({ page }) => {
  await fixture(page, false);
  await expect(
    page.getByRole('button', { name: 'Nuevo', exact: true }),
  ).toHaveCount(0);
});

test('desplegable buscable de actividades en legajos', async ({
  page,
}, info) => {
  await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Nuevo legajo',
    exact: true,
  });
  await dialog.getByLabel('Empresa', { exact: true }).click();
  let popup = dialog.locator('.select-popup');
  await popup.getByLabel('Buscar opciones').fill('empresa de prueba');
  await popup.getByRole('option', { name: 'Empresa de prueba' }).click();
  const activity = dialog.getByLabel('Actividad de empresa', { exact: true });
  await expect(activity.locator('option[value="5"]')).toHaveCount(1);
  await expect(activity).toBeEnabled();
  await activity.click();
  popup = dialog.locator('.select-popup');
  await popup.getByLabel('Buscar opciones').fill('ACTIVIDAD');
  await expect(popup.getByRole('option')).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath('actividades-busqueda.png'),
    fullPage: true,
  });
  await popup.getByRole('option', { name: 'Actividad de prueba' }).click();
  await expect(activity).toHaveValue('5');
  await expect(popup).not.toBeVisible();
});
