import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import type {
  ConvenioCompleto,
  ConvenioWrite,
  ImportesRequest,
  VersionImporte,
} from '../src/features/convenios/types/convenio';
test.setTimeout(300000);
test.use({ actionTimeout: 15000 });
async function fixture(
  page: Page,
  permissions = ['convenios:read', 'convenios:write', 'convenios:delete'],
) {
  const records = new Map<number, ConvenioCompleto>();
  const versions: VersionImporte[] = [];
  const writes: ConvenioWrite[] = [];
  const adjustments: { data: ImportesRequest; persist: boolean }[] = [];
  let failSave = false;
  let stale = false;
  let next = 1;
  let nextCategory = 10;
  let detailGate: Promise<void> | null = null;
  const version = (
    id: number,
    amount: string | null,
    period = '2026-01-01',
  ): VersionImporte => ({
    id: versions.length + 1,
    idCategoria: id,
    periodoDesde: period,
    revision: 1,
    importe: amount,
    adicional1: '0.0000',
    adicional2: null,
    origen: 'INICIAL',
    idVersionBase: null,
    porcentajeImporte: null,
    porcentajeAdicional1: null,
    porcentajeAdicional2: null,
    motivo: 'Inicial',
    creadoEn: '2026-10-10T12:00:00Z',
    creadoPorUserId: 7,
    creadoPorUserGuid: null,
  });
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
            permissions,
          },
        },
      });
    expect(req.headers().authorization).toBe('Bearer test-only-access');
    if (path === '/api/convenios' && method === 'GET')
      return route.fulfill({
        json: {
          items: [...records.values()].map((x) => x.convenio),
          page: 1,
          pageSize: 25,
          total: records.size,
        },
      });
    const id = Number(path.split('/')[3]);
    if (path.endsWith('/historial')) {
      const category = Number(path.split('/')[4]);
      const rows = versions.filter((x) => x.idCategoria === category).reverse();
      return route.fulfill({
        json: { items: rows, page: 1, pageSize: 25, total: rows.length },
      });
    }
    if (path.endsWith('/anular')) {
      const category = Number(path.split('/')[4]);
      const base = versions.find((x) => x.id === Number(path.split('/')[6]))!;
      versions.push({
        ...base,
        id: versions.length + 1,
        revision: base.revision + 1,
        origen: 'ANULACION',
        motivo: req.postDataJSON().motivo,
        idCategoria: category,
      });
      return route.fulfill({ json: {} });
    }
    if (path.includes('/importes') && method === 'POST') {
      const data: ImportesRequest = req.postDataJSON();
      const persist = !path.endsWith('/previsualizar');
      adjustments.push({ data, persist });
      if (persist && stale) {
        stale = false;
        return route.fulfill({
          status: 409,
          json: {
            detail:
              'Categoría 10: La revisión cambió. Consulte el historial y vuelva a previsualizar.',
          },
        });
      }
      const results = data.categorias.map((c) => {
        const v = {
          ...version(
            c.idCategoria,
            c.propuesta.modo === 'porcentaje'
              ? '1100.0000'
              : (c.propuesta.importe ?? null),
            `${c.propuesta.periodoDesde.slice(2)}-${c.propuesta.periodoDesde.slice(0, 2)}-01`,
          ),
          origen: c.propuesta.modo === 'porcentaje' ? 'PORCENTAJE' : 'FINAL',
          revision: c.propuesta.revisionEsperada + 1,
          idVersionBase: c.propuesta.idVersionBase ?? null,
        };
        if (persist) versions.push(v);
        return { version: v, versionesDependientes: [], persistido: persist };
      });
      return route.fulfill({
        json: { categorias: results, persistido: persist },
      });
    }
    if (path.endsWith('/completo') && method === 'GET') {
      if (detailGate) await detailGate;
      const record = structuredClone(records.get(id)!);
      const p = url.searchParams.get('periodo') ?? '102026';
      const date = `${p.slice(2)}-${p.slice(0, 2)}-01`;
      record.periodo = p;
      for (const c of record.categorias) {
        const all = versions.filter((x) => x.idCategoria === c.categoria.id);
        const latest = all.filter(
          (x) =>
            !all.some(
              (y) =>
                y.periodoDesde === x.periodoDesde && y.revision > x.revision,
            ),
        );
        const effective = latest
          .filter((x) => x.periodoDesde <= date && x.origen !== 'ANULACION')
          .sort((a, b) => b.periodoDesde.localeCompare(a.periodoDesde))[0];
        const base = latest
          .filter((x) => x.periodoDesde < date && x.origen !== 'ANULACION')
          .sort((a, b) => b.periodoDesde.localeCompare(a.periodoDesde))[0];
        c.escala = effective
          ? { version: effective, hastaExclusivo: null }
          : null;
        c.escalaInicial =
          [...latest].sort((a, b) =>
            a.periodoDesde.localeCompare(b.periodoDesde),
          )[0] ?? null;
        c.versionBase = base ?? null;
        c.revisionPeriodo =
          latest.find((x) => x.periodoDesde === date)?.revision ?? 0;
        c.tieneHistoria = all.length > 0;
        c.proximaEscala =
          latest
            .filter((x) => x.periodoDesde > date && x.origen !== 'ANULACION')
            .sort((a, b) => a.periodoDesde.localeCompare(b.periodoDesde))[0] ??
          null;
      }
      return route.fulfill({ json: record });
    }
    if (path.endsWith('/completo') && (method === 'POST' || method === 'PUT')) {
      const data: ConvenioWrite = req.postDataJSON();
      writes.push(data);
      if (failSave)
        return route.fulfill({
          status: 409,
          json: {
            detail:
              'No se pudo guardar el convenio y sus categorías por un conflicto de datos. No se guardaron cambios parciales.',
          },
        });
      const key = method === 'POST' ? next++ : id;
      const prev = records.get(key)?.categorias ?? [];
      const categorias = [
        ...prev.filter(
          (c) =>
            !data.categoriasEliminar.includes(c.categoria.id) &&
            !data.categorias.some((x) => x.id === c.categoria.id),
        ),
        ...data.categorias.map((c) => {
          expect(c).not.toHaveProperty('convenioNombre');
          expect(c).not.toHaveProperty('importe');
          const categoryId = c.id ?? nextCategory++;
          if (c.escalaInicial) {
            versions.push(version(categoryId, c.escalaInicial.importe ?? null));
          }
          const v = versions.find((x) => x.idCategoria === categoryId);
          const { escalaInicial: _, ...metadata } = c;
          return {
            categoria: {
              ...metadata,
              id: categoryId,
              idConvenio: key,
              convenioNombre: data.convenio.nombre,
            },
            tieneHistoria: !!v,
            escala: v ? { version: v, hastaExclusivo: null } : null,
            proximaEscala: null,
            versionBase: v ?? null,
            revisionPeriodo: 0,
          };
        }),
      ];
      const record = {
        convenio: { ...data.convenio, id: key },
        periodo: '102026',
        periodoOperativo: '102026',
        categorias,
      };
      records.set(key, record);
      return route.fulfill({
        status: method === 'POST' ? 201 : 200,
        json: record,
      });
    }
    if (method === 'DELETE') {
      records.delete(id);
      return route.fulfill({ status: 204 });
    }
    throw new Error(`Unexpected ${method} ${path}`);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const menu = page.getByRole('button', { name: 'Menú', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Convenios', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Convenios', exact: true }),
  ).toBeVisible({ timeout: 30000 });
  return {
    records,
    writes,
    versions,
    adjustments,
    fail: (v: boolean) => {
      failSave = v;
    },
    stale: () => {
      stale = true;
    },
    gate: (v: Promise<void> | null) => {
      detailGate = v;
    },
  };
}
async function addCategory(page: Page, name: string, scale = true) {
  await page
    .getByRole('button', { name: 'Agregar categoría', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Nueva categoría',
    exact: true,
  });
  await dialog.getByLabel('Descripción', { exact: true }).fill(name);
  await dialog.getByLabel('Condición', { exact: true }).selectOption('1');
  await dialog.getByLabel('Horas normales', { exact: true }).fill('200');
  if (scale) {
    await dialog.getByLabel('Cargar escala inicial').check();
    await dialog.getByLabel('Desde', { exact: true }).fill('2026-01');
    await dialog.getByLabel('Importe', { exact: true }).fill('1000.0000');
    await dialog.getByLabel('Adicional 1', { exact: true }).fill('0');
  }
  await dialog
    .getByRole('button', { name: 'Agregar al convenio', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}
test('Root layout, local categories, three saves, undo and cancel', async ({
  page,
}, info) => {
  const api = await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  let dialog = page.getByRole('dialog', {
    name: 'Nuevo convenio',
    exact: true,
  });
  await dialog.getByLabel('Código', { exact: true }).fill('42');
  await dialog.getByLabel('Nombre', { exact: true }).fill('Convenio de prueba');
  await dialog
    .getByLabel('Descripción', { exact: true })
    .fill('Descripción general');
  await addCategory(page, 'Administrativo');
  expect(api.writes).toHaveLength(0);
  await page.screenshot({
    path: info.outputPath('convenio-root.png'),
    fullPage: true,
  });
  const styles = await dialog
    .locator('.convenio-root input')
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        h: getComputedStyle(n).height,
        font: getComputedStyle(n).fontFamily,
      })),
    );
  expect(new Set(styles.map((s) => s.h)).size).toBe(1);
  expect(new Set(styles.map((s) => s.font)).size).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page }).include('dialog[open]').analyze();
  expect(
    axe.violations.filter((x) =>
      ['critical', 'serious'].includes(x.impact ?? ''),
    ),
  ).toEqual([]);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Editar convenio', exact: true });
  await expect(dialog).toBeVisible();
  expect(api.records.size).toBe(1);
  expect(api.writes[0]?.categorias[0]?.escalaInicial?.importe).toBe(
    '1000.0000',
  );
  await dialog.getByLabel('Nombre', { exact: true }).fill('Modificado');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(
    dialog.getByText('El convenio se guardó correctamente.'),
  ).toBeVisible();
  expect(api.records.size).toBe(1);
  await dialog.getByLabel('Nombre', { exact: true }).fill('Descartar');
  await dialog.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(dialog.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Modificado',
  );
  await dialog
    .getByRole('button', { name: 'Guardar y nuevo', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: 'Nuevo convenio', exact: true });
  await expect(dialog.getByLabel('Nombre', { exact: true })).toHaveValue('');
  await dialog.getByLabel('Nombre', { exact: true }).fill('Segundo');
  await dialog
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(api.records.size).toBe(2);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await addCategory(page, 'Sin guardar', false);
  await page
    .getByRole('dialog', { name: 'Nuevo convenio', exact: true })
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  expect(api.records.size).toBe(2);
});
test('batch preview, stale revision, history and read-only screens', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'desktop',
    'Business flow once; Root is verified at all viewport sizes.',
  );
  const api = await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Escalas');
  await addCategory(page, 'Categoría A');
  await addCategory(page, 'Categoría B');
  await page
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Escalas', exact: true }).click();
  const scales = page.getByRole('dialog', {
    name: 'Escalas del convenio',
    exact: true,
  });
  await scales.getByLabel('Seleccionar fila 10', { exact: true }).check();
  await scales.getByLabel('Seleccionar fila 11', { exact: true }).check();
  await scales
    .getByRole('button', { name: 'Ajustar seleccionadas', exact: true })
    .click();
  let edit = page.getByRole('dialog', {
    name: 'Ajustar categorías seleccionadas',
    exact: true,
  });
  await edit.getByLabel('Importe (%)', { exact: true }).fill('10');
  await edit.getByLabel('Motivo', { exact: true }).fill('Ajuste noviembre');
  await edit
    .getByRole('button', { name: 'Previsualizar', exact: true })
    .click();
  await expect(
    edit.getByText('Previsualización — todavía sin guardar'),
  ).toBeVisible();
  expect(api.versions).toHaveLength(2);
  expect(
    api.adjustments[0]?.data.categorias.map((c) => c.propuesta.idVersionBase),
  ).toEqual([1, 2]);
  await page.screenshot({
    path: info.outputPath('convenio-ajuste.png'),
    fullPage: true,
  });
  api.stale();
  await edit
    .getByRole('button', { name: 'Publicar escala', exact: true })
    .click();
  await expect(edit.getByText(/La revisión cambió/)).toBeVisible();
  await expect(edit.getByLabel('Motivo', { exact: true })).toHaveValue(
    'Ajuste noviembre',
  );
  await expect(
    edit.getByRole('button', { name: 'Publicar escala', exact: true }),
  ).toBeDisabled();
  await edit
    .getByRole('button', { name: 'Previsualizar', exact: true })
    .click();
  await expect(
    edit.getByText('Previsualización — todavía sin guardar'),
  ).toBeVisible();
  await edit
    .getByRole('button', { name: 'Publicar escala', exact: true })
    .click();
  await expect(edit).not.toBeVisible();
  expect(api.versions).toHaveLength(4);
  await scales
    .getByRole('button', { name: 'Historial', exact: true })
    .first()
    .click();
  const history = page.getByRole('dialog', {
    name: 'Historial de escalas',
    exact: true,
  });
  await expect(history.getByText('PORCENTAJE', { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('convenio-historial.png'),
    fullPage: true,
  });
  await history
    .getByRole('button', { name: 'Anular versión', exact: true })
    .first()
    .click();
  const cancel = page.getByRole('dialog', {
    name: 'Anular programación',
    exact: true,
  });
  await cancel.getByLabel('Motivo', { exact: true }).fill('Reprogramar');
  await cancel
    .getByRole('button', { name: 'Confirmar anulación', exact: true })
    .click();
  await expect(cancel).not.toBeVisible();
  await expect(history.getByText('ANULACION', { exact: true })).toBeVisible();
});
test('failed save keeps draft, loading skeleton and read-only permission', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  const api = await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  let dialog = page.getByRole('dialog', {
    name: 'Nuevo convenio',
    exact: true,
  });
  await dialog.getByLabel('Nombre', { exact: true }).fill('Conservar borrador');
  api.fail(true);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(
    dialog.getByText(/No se guardaron cambios parciales/),
  ).toBeVisible();
  await expect(dialog.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Conservar borrador',
  );
  api.fail(false);
  await dialog
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  let release!: () => void;
  api.gate(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Ver convenio', exact: true });
  await expect(
    dialog.getByRole('status', { name: 'Cargando formulario de convenio' }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('convenio-skeleton.png'),
    fullPage: true,
  });
  release();
  await expect(dialog.getByLabel('Nombre', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(
    dialog.getByRole('button', { name: 'Guardar', exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
});
test('read permission does not expose write or delete actions', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await fixture(page, ['convenios:read']);
  await expect(
    page.getByRole('button', { name: 'Nuevo', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('No hay convenios para mostrar.')).toBeVisible();
});

test('corrección inicial conserva período e historial', async ({
  page,
}, info) => {
  const api = await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Corrección');
  await addCategory(page, 'Categoría inicial');
  await page
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Escalas', exact: true }).click();
  await page
    .getByRole('button', { name: 'Corregir escala inicial', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Corregir escala inicial',
    exact: true,
  });
  await expect(dialog.getByLabel('Desde', { exact: true })).toHaveValue(
    '2026-01',
  );
  await expect(dialog.getByLabel('Desde', { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Modo', { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Importe', { exact: true })).toHaveValue(
    '1000.0000',
  );
  await dialog.getByLabel('Importe', { exact: true }).fill('1200.1234');
  await dialog
    .getByLabel('Motivo', { exact: true })
    .fill('Error de carga inicial');
  await dialog
    .getByRole('button', { name: 'Previsualizar', exact: true })
    .click();
  await expect(
    dialog.getByText('Previsualización — todavía sin guardar'),
  ).toBeVisible();
  expect(api.versions).toHaveLength(1);
  expect(api.adjustments.at(-1)!.data.categorias[0]!.propuesta).toMatchObject({
    periodoDesde: '012026',
    revisionEsperada: 1,
    corregirInicial: true,
    importe: '1200.1234',
    modo: 'final',
  });
  await dialog.screenshot({ path: info.outputPath('correccion-inicial.png') });
  await dialog
    .getByRole('button', { name: 'Publicar corrección', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(api.versions).toHaveLength(2);
  expect(api.versions[0]!.importe).toBe('1000.0000');
  expect(api.versions[1]!.revision).toBe(2);
});
