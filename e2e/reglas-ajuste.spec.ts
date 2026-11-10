import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import type {
  ReglaWrite,
  Version,
  Regla,
} from '../src/features/reglas-ajuste/types';
test.setTimeout(180000);
test('publica importe mensual conservando vigencia, precisión y fuente', async ({
  page,
}, info) => {
  const f = await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Nueva regla de ajuste',
    exact: true,
  });
  await dialog
    .getByLabel('Nombre', { exact: true })
    .fill('Cuota publicada - escenario de prueba');
  await dialog.getByLabel('Período desde', { exact: true }).fill('2026-11');
  await dialog.getByLabel('Período hasta', { exact: true }).fill('2026-11');
  await dialog
    .getByLabel('Operación', { exact: true })
    .selectOption('fijarImporteMensual');
  await dialog.getByLabel('Importe ($)', { exact: true }).fill('123.4567');
  await dialog
    .getByLabel('Motivo', { exact: true })
    .fill('Publicación ficticia utilizada en la prueba');
  await dialog
    .getByRole('button', { name: 'Agregar fórmulas', exact: true })
    .click();
  const selector = page.getByRole('dialog', {
    name: 'Agregar fórmulas',
    exact: true,
  });
  await selector
    .getByRole('row')
    .filter({ hasText: 'Fórmula 01' })
    .getByRole('checkbox')
    .check();
  await selector
    .getByRole('button', { name: 'Agregar seleccionadas (1)', exact: true })
    .click();
  await expect(
    dialog.getByText(/Generá primero la liquidación mensual/),
  ).toBeVisible();
  await expect(
    dialog.getByLabel('Expresión de base', { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `artifacts/contribuciones-${info.project.name}.png`,
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(f.writes[0]).toMatchObject({
    periodoDesde: '112026',
    periodoHasta: '112026',
    ajuste: { tipo: 'fijarImporteMensual', valor: '123.4567' },
  });
  expect(f.writes[0]?.ajuste.expresionBase).toBeUndefined();
});
async function fixture(page: Page, writable = true) {
  let next = 1;
  let conflict = false;
  const rules = new Map<number, { nombre: string; versions: Version[] }>();
  const writes: ReglaWrite[] = [];
  const formulas = Array.from({ length: 32 }, (_, i) => ({
    id: i + 1,
    codigo: 100 + i,
    descripcion: `Fórmula ${String(i + 1).padStart(2, '0')}`,
    convenioId: 3,
    convenioNombre: 'Comercio',
    activo: true,
  }));
  const summary = (
    id: number,
    r: { nombre: string; versions: Version[] },
  ): Regla => ({
    id,
    nombre: r.nombre,
    revisionActual: r.versions.length,
    estado: 'activa',
    versionPeriodo: r.versions.length
      ? { ...r.versions.at(-1)!, tipoAjuste: r.versions.at(-1)!.ajuste.tipo }
      : null,
  });
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const method = req.method();
    if (p === '/api/auth/login')
      return route.fulfill({ json: loginResponse() });
    if (p === '/api/auth/refresh')
      return route.fulfill({ status: 401, json: {} });
    if (p === '/api/users/me')
      return route.fulfill({
        json: {
          actor: {
            userId: 7,
            tenantId: 2,
            applicationId: 42,
            isSuperAdmin: false,
            permissions: [
              'formulas:read',
              ...(writable ? ['formulas:write'] : []),
              'convenios:read',
              'auxiliar:read',
            ],
          },
        },
      });
    if (p === '/api/convenios')
      return route.fulfill({
        json: {
          items: [{ id: 3, nombre: 'Comercio' }],
          total: 1,
          page: 1,
          pageSize: 100,
        },
      });
    if (p === '/api/codigosdemodalidaddecontratacion')
      return route.fulfill({
        json: [
          { id: 88, codigoArca: 710, descripcion: 'RIFL' },
          { id: 89, codigoArca: null, descripcion: 'Sin vincular' },
        ],
      });
    if (p === '/api/formulas') {
      const pageNo = Number(u.searchParams.get('page') ?? 1);
      const size = Number(u.searchParams.get('pageSize') ?? 25);
      const buscar = u.searchParams.get('buscar') ?? '';
      const found = formulas.filter((x) => x.descripcion.includes(buscar));
      return route.fulfill({
        json: {
          items: found.slice((pageNo - 1) * size, pageNo * size),
          total: found.length,
          page: pageNo,
          pageSize: size,
        },
      });
    }
    if (p === '/api/reglas-ajuste/formulas')
      return route.fulfill({
        json: formulas.filter((x) =>
          (u.searchParams.get('ids') ?? '').split(',').includes(String(x.id)),
        ),
      });
    if (p === '/api/reglas-ajuste' && method === 'GET') {
      const found = [...rules]
        .map(([id, r]) => summary(id, r))
        .filter((x) => x.nombre.includes(u.searchParams.get('buscar') ?? ''));
      return route.fulfill({
        json: { items: found, total: found.length, page: 1, pageSize: 25 },
      });
    }
    const id = Number(p.split('/')[3]);
    const r = rules.get(id);
    if (
      method === 'POST' &&
      (p === '/api/reglas-ajuste' || p.endsWith('/versiones'))
    ) {
      const data = req.postDataJSON() as ReglaWrite;
      if (conflict) {
        conflict = false;
        if (r) {
          r.versions.push({
            ...r.versions.at(-1)!,
            id: r.versions.length + 1,
            revision: r.versions.length + 1,
            motivo: 'Otro usuario',
          });
        }
        return route.fulfill({
          status: 409,
          json: {
            detail:
              'La revisión cambió. Consulte el historial antes de publicar.',
          },
        });
      }
      if (r && data.revisionEsperada !== r.versions.length)
        return route.fulfill({
          status: 409,
          json: {
            detail:
              'La revisión cambió. Consulte el historial antes de publicar.',
          },
        });
      writes.push(data);
      const key = r ? id : next++;
      const record = r ?? { nombre: data.nombre, versions: [] };
      const date = (p: string) => `${p.slice(2)}-${p.slice(0, 2)}-01`;
      const v: Version = {
        ...data,
        id: record.versions.length + 1,
        idRegla: key,
        revision: record.versions.length + 1,
        periodoDesde: date(data.periodoDesde),
        periodoHasta: data.periodoHasta ? date(data.periodoHasta) : null,
        creadoEn: '2026-10-13T12:00:00Z',
        creadoPorUserId: 7,
        creadoPorUserGuid: 'test',
      };
      record.versions.push(v);
      rules.set(key, record);
      return route.fulfill({ status: 201, json: v });
    }
    if (r && p.endsWith('/versiones'))
      return route.fulfill({
        json: {
          items: [...r.versions].reverse(),
          total: r.versions.length,
          page: 1,
          pageSize: 25,
        },
      });
    if (r && p.includes('/versiones/'))
      return route.fulfill({
        json: r.versions.find((x) => x.id === Number(p.split('/').at(-1))),
      });
    if (r)
      return route.fulfill({
        json: { regla: summary(id, r), ultimaVersion: r.versions.at(-1) },
      });
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
  await page
    .getByRole('link', { name: 'Reglas de ajuste', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Reglas de ajuste', exact: true }),
  ).toBeVisible({ timeout: 30000 });
  return {
    writes,
    rules,
    failNext: () => {
      conflict = true;
    },
  };
}
test('alta, selección entre páginas, revisión, conflicto e historial', async ({
  page,
}, info) => {
  const f = await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Nueva regla de ajuste',
    exact: true,
  });
  await dialog.getByLabel('Nombre', { exact: true }).fill('RIFL 710');
  await dialog.getByLabel('Período desde', { exact: true }).fill('2026-05');
  await dialog
    .getByLabel('Operación', { exact: true })
    .selectOption('fijarAlicuota');
  await dialog.getByLabel('Porcentaje (%)', { exact: true }).fill('1.3100');
  await dialog.getByLabel('Expresión de base', { exact: true }).fill('C310B');
  await dialog
    .getByLabel('Motivo', { exact: true })
    .fill('Elegibilidad verificada');
  await dialog
    .getByRole('button', { name: 'Agregar fórmulas', exact: true })
    .click();
  const selector = page.getByRole('dialog', {
    name: 'Agregar fórmulas',
    exact: true,
  });
  await selector
    .getByRole('row')
    .filter({ hasText: 'Fórmula 01' })
    .getByRole('checkbox')
    .check();
  await selector
    .getByRole('button', { name: 'Página siguiente', exact: true })
    .click();
  await selector
    .getByRole('row')
    .filter({ hasText: 'Fórmula 26' })
    .getByRole('checkbox')
    .check();
  await selector
    .getByRole('button', { name: 'Agregar seleccionadas (2)', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Agregar condición', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Seleccionar valores', exact: true })
    .click();
  const modalidades = page.getByRole('dialog', {
    name: 'Seleccionar Modalidad (código ARCA)',
    exact: true,
  });
  await modalidades
    .getByRole('row')
    .filter({ hasText: 'RIFL' })
    .getByRole('checkbox')
    .check();
  await modalidades
    .getByRole('button', { name: 'Aplicar selección (1)', exact: true })
    .click();
  await page.screenshot({
    path: `artifacts/reglas-${info.project.name}-alta.png`,
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  const edit = page.getByRole('dialog', {
    name: 'Editar regla de ajuste',
    exact: true,
  });
  await expect(
    edit.getByText('Regla publicada correctamente. Revisión 1.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.writes[0]?.formulas).toEqual([1, 26]);
  expect(f.writes[0]?.condiciones[0]?.valores).toEqual([710]);
  await expect(edit.getByLabel('Nombre', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await edit
    .getByLabel('Motivo', { exact: true })
    .fill('Corrección conservada');
  f.failNext();
  await edit.getByRole('button', { name: 'Guardar', exact: true }).click();
  await edit
    .getByRole('button', { name: 'Consultar publicación actual', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Conservar borrador y usar revisión 2',
      exact: true,
    })
    .click();
  await expect(edit.getByLabel('Motivo', { exact: true })).toHaveValue(
    'Corrección conservada',
  );
  await edit
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(edit).not.toBeVisible();
  expect(f.writes.at(-1)?.revisionEsperada).toBe(2);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await edit.getByLabel('Porcentaje (%)', { exact: true }).fill('2');
  await edit.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(edit.getByLabel('Porcentaje (%)', { exact: true })).toHaveValue(
    '1.3100',
  );
  await edit.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(f.writes).toHaveLength(2);
  await page.getByRole('button', { name: 'Historial', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Historial · RIFL 710' }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/reglas-${info.project.name}-historial.png`,
    fullPage: true,
  });
  await page
    .getByRole('dialog', { name: 'Historial · RIFL 710' })
    .getByRole('button', { name: 'Cerrar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
  const deactivate = page.getByRole('dialog', {
    name: 'Desactivar regla de ajuste',
    exact: true,
  });
  await deactivate.getByLabel('Período desde', { exact: true }).fill('2026-11');
  await deactivate
    .getByLabel('Motivo', { exact: true })
    .fill('Fin de beneficio');
  await expect(
    deactivate.getByLabel('Activa', { exact: true }),
  ).not.toBeChecked();
  await deactivate
    .getByRole('button', { name: 'Guardar y nuevo', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog', { name: 'Nueva regla de ajuste', exact: true })
      .getByLabel('Nombre', { exact: true }),
  ).toHaveValue('');
  expect(f.writes.at(-1)?.activa).toBe(false);
  expect(f.rules.size).toBe(1);
  await page
    .getByRole('dialog', { name: 'Nueva regla de ajuste', exact: true })
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});
test('consulta sin permiso de escritura no ofrece altas', async ({ page }) => {
  await fixture(page, false);
  await expect(
    page.getByRole('button', { name: 'Nuevo', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('No hay reglas para los filtros indicados.', {
      exact: true,
    }),
  ).toBeVisible();
});
