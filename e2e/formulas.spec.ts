import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import { emptyFormula } from '../src/features/formulas/schemas/formulaSchema';
import type {
  FormulaCompleta,
  FormulaWrite,
} from '../src/features/formulas/types/formula';
test.setTimeout(300000);
test.use({ actionTimeout: 15000 });
async function fixture(
  page: Page,
  permissions = [
    'formulas:read',
    'formulas:write',
    'formulas:delete',
    'auxiliar:read',
    'convenios:read',
    'conceptos:read',
  ],
  isSuperAdmin = false,
) {
  const records = new Map<number, FormulaCompleta>();
  const writes: { method: string; data: FormulaWrite }[] = [];
  let next = 1;
  let child = 10;
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
            isSuperAdmin,
            permissions,
          },
        },
      });
    expect(req.headers().authorization).toBe('Bearer test-only-access');
    if (path === '/api/convenios')
      return route.fulfill({
        json: {
          items: [{ id: 3, nombre: 'Comercio' }],
          page: 1,
          pageSize: 100,
          total: 1,
        },
      });
    if (path === '/api/conceptos')
      return route.fulfill({
        json: {
          items: [{ id: 2, descripcion: 'Sueldo', columnaRecibo: 0 }],
          page: 1,
          pageSize: 100,
          total: 1,
        },
      });
    if (path === '/api/unidades')
      return route.fulfill({ json: [{ id: 1, descripcion: 'Días' }] });
    if (path === '/api/meses')
      return route.fulfill({
        json: [
          { id: 1, numeroMes: 1, nombreMes: 'Enero' },
          { id: 2, numeroMes: 2, nombreMes: 'Febrero' },
        ],
      });
    if (path === '/api/tipoliquidacion')
      return route.fulfill({
        json: Array.from({ length: 32 }, (_, i) => ({
          id: i + 1,
          descripcion: `Liquidación ${i + 1}`,
        })),
      });
    if (path === '/api/formulas/exportar')
      return route.fulfill({
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: 'test-only-xlsx',
      });
    if (path === '/api/formulas' && method === 'GET') {
      const rows = [...records.values()]
        .map((x) => x.formula)
        .filter(
          (x) =>
            !url.searchParams.get('buscar') ||
            x.descripcion?.includes(url.searchParams.get('buscar')!),
        );
      return route.fulfill({
        json: { items: rows, page: 1, pageSize: 25, total: rows.length },
      });
    }
    const id = Number(path.split('/')[3]);
    if (path.endsWith('/completa') && method === 'GET')
      return records.has(id)
        ? route.fulfill({ json: records.get(id) })
        : route.fulfill({ status: 404, json: {} });
    if (path.endsWith('/duplicados')) {
      const source = records.get(id)!;
      const key = next++;
      const copy = {
        formula: { ...source.formula, id: key },
        periodos: [],
        tiposLiquidacion: [],
      };
      records.set(key, copy);
      return route.fulfill({ status: 201, json: copy.formula });
    }
    if (method === 'DELETE') {
      records.delete(id);
      return route.fulfill({ status: 204 });
    }
    if (method === 'POST' || method === 'PUT') {
      const data = req.postDataJSON() as FormulaWrite;
      writes.push({ method, data });
      if (fail) {
        fail = false;
        return route.fulfill({
          status: 409,
          json: {
            detail:
              'No se pudo guardar la fórmula por un conflicto de datos. No se guardaron cambios parciales.',
          },
        });
      }
      const key = Number.isNaN(id) ? next++ : id;
      const old = records.get(key);
      const periods = (old?.periodos ?? []).filter(
        (x) => !data.periodosEliminar.includes(x.id!),
      );
      for (const p of data.periodos) {
        const index = periods.findIndex((x) => p.id !== null && x.id === p.id);
        const row = {
          ...p,
          id: p.id ?? child++,
          mesNombre: p.numeroMes === 1 ? 'Enero' : 'Febrero',
        };
        if (index >= 0) periods[index] = row;
        else periods.push(row);
      }
      const types = (old?.tiposLiquidacion ?? []).filter(
        (x) => !data.tiposLiquidacionEliminar.includes(x.id!),
      );
      for (const t of data.tiposLiquidacion) {
        const index = types.findIndex((x) => t.id !== null && x.id === t.id);
        const row = {
          ...t,
          id: t.id ?? child++,
          tipoLiquidacionDescripcion: `Liquidación ${t.idTipoLiquidacion}`,
        };
        if (index >= 0) types[index] = row;
        else types.push(row);
      }
      let saved: FormulaCompleta = {
        formula: {
          ...data.formula,
          id: key,
          convenioNombre: 'Comercio',
          conceptoDescripcion: 'Sueldo',
          unidadDescripcion: 'Días',
          variable: 'C310',
          descripcionCompleta: data.formula.descripcion,
        },
        periodos: periods,
        tiposLiquidacion: types,
      };
      records.set(key, structuredClone(saved));
      if (path.endsWith('/clonar')) {
        const cloneId = next++;
        saved = {
          ...structuredClone(saved),
          formula: { ...saved.formula, id: cloneId, formulaBase: null },
        };
        records.set(cloneId, saved);
      }
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
  await page.getByRole('link', { name: 'Fórmulas', exact: true }).click();
  return {
    records,
    writes,
    failNext: () => {
      fail = true;
    },
    seed: () => {
      records.set(next, {
        formula: {
          ...emptyFormula,
          id: next++,
          descripcion: 'Existente',
          formulaCantidad: 'DIAS',
          formulaBase: 'SUELDO',
          cargarComoNovedad: null,
          convenioNombre: null,
          conceptoDescripcion: null,
          unidadDescripcion: null,
          variable: '',
          descripcionCompleta: 'Existente',
        },
        periodos: [],
        tiposLiquidacion: [],
      });
    },
  };
}
test('cantidad LSD: conserva cálculo y guarda la opción de exportación', async ({ page }, info) => {
  const state = await fixture(page, undefined, true);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Nueva fórmula', exact: true });
  await dialog.getByLabel('Descripción', { exact: true }).fill('Kilómetros recorridos');
  await dialog.getByLabel('Cantidad', { exact: true }).fill('1200');
  const flag = dialog.getByLabel('Informar cantidad en TXT de Libro de sueldo', { exact: true });
  await expect(flag).toBeChecked();
  await flag.uncheck();
  await flag.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('cantidad-lsd.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Editar fórmula', exact: true });
  await expect(dialog.getByLabel('Informar cantidad en TXT de Libro de sueldo', { exact: true })).not.toBeChecked();
  await expect(dialog.getByLabel('Cantidad', { exact: true })).toHaveValue('1200');
  expect(state.writes[0].data.formula.informarCantidadLsd).toBe(false);
  expect(state.writes[0].data.formula.formulaCantidad).toBe('1200');
  expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([]);
});

test('guardados, multiselección, reglas de expresiones y diseño', async ({
  page,
}, info) => {
  const state = await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Nueva fórmula', exact: true });
  await dialog.getByLabel('Convenio', { exact: true }).selectOption('3');
  await dialog.getByLabel('Concepto', { exact: true }).selectOption('2');
  await dialog.getByLabel('Código', { exact: true }).fill('10');
  await dialog.getByLabel('Descripción', { exact: true }).fill('Sueldo básico');
  await expect(dialog.getByLabel('Base', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await dialog.getByLabel('Cantidad', { exact: true }).fill('DIAS');
  await dialog.getByLabel('Base', { exact: true }).fill('SUELDO / 30');
  await expect(dialog.getByLabel('Importe', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await dialog
    .getByRole('button', { name: 'Agregar tipos de liquidación', exact: true })
    .click();
  let selector = page.getByRole('dialog', {
    name: 'Agregar tipos de liquidación',
    exact: true,
  });
  await selector
    .getByRole('row')
    .filter({ hasText: 'Liquidación 1' })
    .first()
    .getByRole('checkbox')
    .check();
  await selector
    .getByLabel('Buscar tipos de liquidación')
    .fill('Liquidación 32');
  await selector
    .getByRole('row')
    .filter({ hasText: 'Liquidación 32' })
    .getByRole('checkbox')
    .check();
  await selector
    .getByRole('button', { name: 'Agregar seleccionados (2)', exact: true })
    .click();
  await dialog.getByRole('tab', { name: 'Períodos (0)' }).click();
  await dialog
    .getByRole('button', { name: 'Agregar períodos', exact: true })
    .click();
  selector = page.getByRole('dialog', {
    name: 'Agregar períodos',
    exact: true,
  });
  await selector
    .getByRole('row')
    .filter({ hasText: 'Enero' })
    .getByRole('checkbox')
    .check();
  await selector
    .getByRole('button', { name: 'Agregar seleccionados (1)', exact: true })
    .click();
  await dialog.getByLabel('Aplicar', { exact: true }).uncheck();
  const periodRow = dialog.getByRole('group', {
    name: 'Período 1',
    exact: true,
  });
  await expect(periodRow).toHaveCSS('border-top-width', '1px');
  await expect(periodRow).toHaveCSS('border-left-width', '1px');
  await expect(
    periodRow.getByRole('button', { name: 'Quitar período' }),
  ).toHaveCSS('font-size', '13px');
  await periodRow.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath('formula-periodos.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Editar fórmula', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Sueldo básico',
  );
  expect(state.writes[0].data.periodos[0].seleccionado).toBe(false);
  expect(state.writes[0].data.tiposLiquidacion).toHaveLength(2);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1].method).toBe('PUT');
  await dialog.getByLabel('Descripción', { exact: true }).fill('Descartar');
  await dialog.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(dialog.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Sueldo básico',
  );
  await dialog
    .getByLabel('Descripción', { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath('formula-form.png'),
    fullPage: true,
  });
  expect(
    (await new AxeBuilder({ page }).include('dialog[open]').analyze())
      .violations,
  ).toEqual([]);
  await dialog.getByRole('tab', { name: 'Tipos de liquidación (2)' }).click();
  await dialog
    .getByText('1 · Liquidación 1', { exact: true })
    .scrollIntoViewIfNeeded();
  const typeRow = dialog.getByRole('group', {
    name: 'Tipo de liquidación 1',
    exact: true,
  });
  await expect(typeRow).toHaveCSS('border-top-width', '1px');
  await expect(typeRow).toHaveCSS('border-right-width', '1px');
  const removeButton = typeRow.getByRole('button', { name: 'Quitar tipo' });
  await expect(removeButton).toHaveCSS('font-size', '13px');
  const rowBox = await typeRow.boundingBox();
  const buttonBox = await removeButton.boundingBox();
  expect(
    rowBox!.x + rowBox!.width - buttonBox!.x - buttonBox!.width,
  ).toBeLessThan(12);
  const addBox = await dialog
    .getByRole('button', { name: 'Agregar tipos de liquidación', exact: true })
    .boundingBox();
  expect(
    Math.abs(addBox!.x + addBox!.width - rowBox!.x - rowBox!.width),
  ).toBeLessThan(2);
  await page.screenshot({
    path: info.outputPath('formula-asociaciones.png'),
    fullPage: true,
  });
  await dialog
    .getByRole('button', { name: 'Guardar y nuevo', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: 'Nueva fórmula', exact: true });
  await expect(dialog.getByLabel('Descripción', { exact: true })).toHaveValue(
    '',
  );
  await dialog.getByLabel('Descripción', { exact: true }).fill('Segunda');
  await dialog
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(state.records.size).toBe(2);
});
test('errores conservan el borrador, cancelar, clonar, duplicar y consulta', async ({
  page,
}) => {
  const state = await fixture(page);
  state.seed();
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  let dialog = page.getByRole('dialog', {
    name: 'Editar fórmula',
    exact: true,
  });
  await dialog.getByLabel('Descripción', { exact: true }).fill('Borrador');
  state.failNext();
  await dialog
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Borrador',
  );
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.records.get(1)!.formula.descripcion).toBe('Existente');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Editar fórmula', exact: true });
  await dialog
    .getByRole('button', { name: 'Guardar y clonar', exact: true })
    .click();
  await expect(dialog.getByLabel('Base', { exact: true })).toHaveValue('');
  expect(state.records.size).toBe(2);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page
    .getByRole('button', { name: 'Duplicar', exact: true })
    .first()
    .click();
  await expect(dialog.getByLabel('Base', { exact: true })).toHaveValue(
    'SUELDO',
  );
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Ver', exact: true }).first().click();
  const view = page.getByRole('dialog', { name: 'Ver fórmula', exact: true });
  await expect(view.getByLabel('Descripción', { exact: true })).toBeDisabled();
  await expect(
    view.getByRole('button', { name: 'Guardar', exact: true }),
  ).toHaveCount(0);
  await view
    .getByRole('button', { name: 'Cerrar', exact: true })
    .last()
    .click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Exportar XLSX', exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe('Formulas.xlsx');
  await page
    .getByRole('button', { name: 'Eliminar', exact: true })
    .first()
    .click();
  const confirmation = page.getByRole('dialog', {
    name: 'Confirmar eliminación',
  });
  await confirmation
    .getByRole('button', { name: 'Eliminar', exact: true })
    .click();
  await expect(confirmation).not.toBeVisible();
  expect(state.records.size).toBe(2);
});

test('sin permisos auxiliares conserva referencias y restringe bajas', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  const state = await fixture(page, ['formulas:read', 'formulas:write']);
  state.seed();
  const record = state.records.get(1)!;
  record.formula.convenioId = 999;
  record.formula.convenioNombre = 'Convenio conservado';
  record.periodos = [
    { id: 22, numeroMes: 1, mesNombre: 'Enero', seleccionado: false },
  ];
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Editar fórmula',
    exact: true,
  });
  await expect(dialog.getByLabel('Convenio', { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Convenio', { exact: true })).toHaveValue(
    '999',
  );
  await dialog.getByRole('tab', { name: 'Períodos (1)' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Quitar período', exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Agregar períodos', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel('Descripción', { exact: true })
    .fill('Referencia preservada');
  await dialog
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes[0].data.formula.convenioId).toBe(999);
  expect(state.records.get(1)!.periodos).toHaveLength(1);
});

test('desplegable buscable de conceptos con dos columnas', async ({
  page,
}, info) => {
  await fixture(page);
  await page.route('**/api/conceptos?**', (route) =>
    route.fulfill({
      json: {
        items: Array.from({ length: 145 }, (_, index) => ({
          id: index + 1,
          codigo: 501 + index,
          descripcion:
            index === 144 ? 'Asignación futura' : `Concepto ${index + 1}`,
          columnaRecibo: index === 144 ? 2 : 0,
        })).slice(
          (Number(new URL(route.request().url()).searchParams.get('page')) -
            1) *
            100,
          Number(new URL(route.request().url()).searchParams.get('page')) * 100,
        ),
        page: Number(new URL(route.request().url()).searchParams.get('page')),
        pageSize: 100,
        total: 145,
      },
    }),
  );
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Nueva fórmula',
    exact: true,
  });
  const select = dialog.getByLabel('Concepto', { exact: true });
  await expect(select).toBeEnabled();
  await expect(select.locator('option')).toHaveCount(146);
  await select.click();
  const popup = dialog.locator('.select-popup');
  await expect(popup).toBeVisible();
  const search = popup.getByRole('combobox', { name: 'Buscar opciones' });
  await expect(search).toBeFocused();
  await expect(popup.getByText('Descripción', { exact: true })).toBeVisible();
  await expect(
    popup.getByText('Columna del recibo', { exact: true }),
  ).toBeVisible();
  await search.fill('asignacion');
  const list = popup.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveCount(1);
  await expect(list.getByRole('option')).toContainText('No remunerativo');
  const rect = await popup.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await page.screenshot({
    path: info.outputPath('conceptos-busqueda-columnas.png'),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await search.fill('inexistente');
  await expect(popup.getByRole('status')).toHaveText('Sin coincidencias');
  await popup.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await search.fill('645');
  await expect(list.getByRole('option')).toHaveCount(1);
  await search.press('Enter');
  await expect(select).toHaveValue('145');
  await expect(
    dialog.getByLabel('Columna del recibo', { exact: true }),
  ).toHaveValue('No remunerativo');
  await expect(select).toBeFocused();
  await select.press('ArrowDown');
  await popup
    .getByRole('combobox', { name: 'Buscar opciones' })
    .press('Escape');
  await expect(dialog).toBeVisible();
  await expect(popup).not.toBeVisible();
  await expect(select).toHaveValue('145');
});

test('edición conserva concepto y unidad con catálogos demorados', async ({
  page,
}) => {
  const state = await fixture(page);
  state.seed();
  Object.assign(state.records.get(1)!.formula, {
    convenioId: 3,
    conceptoId: 2,
    unidadId: 1,
    convenioNombre: 'Comercio',
    conceptoDescripcion: 'Sueldo',
    unidadDescripcion: 'Días',
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/conceptos?**', async (route) => {
    await gate;
    await route.fulfill({
      json: {
        items: [{ id: 2, descripcion: 'Sueldo', columnaRecibo: 0 }],
        page: 1,
        pageSize: 100,
        total: 1,
      },
    });
  });
  await page.route('**/api/unidades', async (route) => {
    await gate;
    await route.fulfill({ json: [{ id: 1, descripcion: 'Días' }] });
  });
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Editar fórmula',
    exact: true,
  });
  const concept = dialog.getByLabel('Concepto', { exact: true });
  const unit = dialog.getByLabel('Unidad', { exact: true });
  await expect(concept).toHaveValue('2');
  await expect(unit).toHaveValue('1');
  await expect(concept).toBeDisabled();
  await expect(unit).toBeDisabled();
  await dialog
    .getByLabel('Descripción', { exact: true })
    .fill('Descripción editada');
  release();
  await expect(concept).toBeEnabled();
  await expect(unit).toBeEnabled();
  await expect(concept).toHaveValue('2');
  await expect(unit).toHaveValue('1');
  for (const control of [concept, unit]) {
    await control.click();
    await dialog
      .locator('.select-popup')
      .getByLabel('Buscar opciones')
      .press('Escape');
    await control.press('Tab');
  }
  await dialog
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes.at(-1)!.data.formula).toMatchObject({
    conceptoId: 2,
    unidadId: 1,
    convenioId: 3,
    descripcion: 'Descripción editada',
  });
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(concept).toHaveValue('2');
  await expect(unit).toHaveValue('1');
  await dialog.getByLabel('Descripción', { exact: true }).fill('Borrador');
  await dialog.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(dialog.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Descripción editada',
  );
  await expect(concept).toHaveValue('2');
  await expect(unit).toHaveValue('1');
});

test('organizar orden requiere convenio y permite mover todas sus fórmulas', async ({
  page,
}, info) => {
  const state = await fixture(page);
  for (let id = 1; id <= 30; id++)
    state.records.set(id, {
      formula: {
        ...emptyFormula,
        id,
        convenioId: 3,
        convenioNombre: 'Comercio',
        codigo: id,
        descripcion: `Fórmula ${id}`,
        descripcionCompleta: `Fórmula ${id}`,
        variable: `C3${id}`,
        orden: id,
        activo: id % 2 === 1,
        conceptoDescripcion: null,
        unidadDescripcion: null,
      },
      periodos: [],
      tiposLiquidacion: [],
    });
  let sequence = Array.from({ length: 30 }, (_, i) => i + 1);
  let version = 'original';
  let writes = 0;
  await page.route('**/api/formulas/orden/3', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as {
        ids: number[];
        huellaEsperada: string;
      };
      expect(body.huellaEsperada).toBe(version);
      expect(body.ids).toHaveLength(30);
      sequence = body.ids;
      version = 'guardada';
      writes++;
      sequence.forEach((id, index) => {
        state.records.get(id)!.formula.orden = index + 1;
      });
    }
    return route.fulfill({
      json: {
        huella: version,
        formulas: sequence.map((id) => state.records.get(id)!.formula),
      },
    });
  });
  const organize = page.getByRole('button', {
    name: 'Organizar orden',
    exact: true,
  });
  await expect(organize).toBeDisabled();
  await page
    .getByRole('combobox', { name: 'Convenio', exact: true })
    .selectOption('3');
  await expect(organize).toBeEnabled();
  await page.getByLabel('Buscar código o descripción').fill('Fórmula 1');
  await page
    .getByRole('combobox', { name: 'Estado', exact: true })
    .selectOption('true');
  await organize.click();
  const dialog = page.getByRole('dialog', {
    name: 'Organizar orden · Comercio',
    exact: true,
  });
  const table = dialog.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(31);
  await expect(table.getByText('Inactivo', { exact: true })).toHaveCount(15);
  await dialog
    .getByRole('button', { name: 'Subir Fórmula 30', exact: true })
    .click();
  expect(writes).toBe(0);
  await page.screenshot({
    path: info.outputPath('orden-formulas.png'),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (info.project.name === 'desktop') {
    await dialog
      .getByRole('button', { name: 'Arrastrar Fórmula 1', exact: true })
      .dragTo(
        table.getByRole('row').filter({
          has: page.getByRole('button', {
            name: 'Arrastrar Fórmula 3',
            exact: true,
          }),
        }),
      );
    await expect(table.getByRole('row').nth(1)).toContainText('Fórmula 2');
  }
  await dialog
    .getByRole('button', { name: 'Guardar orden', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(1);
  expect(sequence.at(-2)).toBe(30);
  await expect(
    page.getByRole('combobox', { name: 'Convenio', exact: true }),
  ).toHaveValue('3');
  await organize.click();
  await expect(table.getByRole('row')).toHaveCount(31);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(1);
});

test('organizar orden respeta usuarios de solo lectura', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await fixture(page, ['formulas:read', 'convenios:read']);
  await page
    .getByRole('combobox', { name: 'Convenio', exact: true })
    .selectOption('3');
  await expect(
    page.getByRole('button', { name: 'Organizar orden', exact: true }),
  ).toHaveCount(0);
});
