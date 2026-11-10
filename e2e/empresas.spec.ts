import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import {
  initialFields,
  toWrite,
} from '../src/features/empresas/schemas/empresaSchema';
import type {
  EmpresaCompleta,
  EmpresaCompletaWrite,
} from '../src/features/empresas/types/empresa';

test.setTimeout(300000);
test.use({ actionTimeout: 15000 });
async function fixture(
  page: Page,
  permissions = [
    'empresas:read',
    'empresas:write',
    'empresas:delete',
    'auxiliar:read',
    'bancos:read',
  ],
) {
  let nextId = 1;
  let nextDetailId = 100;
  const records = new Map<number, EmpresaCompleta>();
  const writes: { method: string; data: EmpresaCompletaWrite }[] = [];
  const bankQueries: string[] = [];
  let failWrite = false;
  let writeGate: Promise<void> | null = null;
  let catalogGate: Promise<void> | null = null;
  const activities = [1, 2, 3].map((id) => ({
    id,
    codigoAfip: 100 + id,
    descripcion: `Actividad ${id}`,
    descripcionAdicional: null,
  }));
  const banks = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    codigoEntidad: 100 + i,
    denominacion: `Banco ${String(i + 1).padStart(2, '0')}`,
    abreviacion: `B${i + 1}`,
  }));
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
            permissions,
          },
        },
      });
    expect(request.headers().authorization).toBe('Bearer test-only-access');
    if (
      [
        '/api/provincias',
        '/api/tipoclaveunica',
        '/api/tipoempresaafip',
      ].includes(path)
    ) {
      if (catalogGate) await catalogGate;
      return route.fulfill({
        json: [
          {
            id: 1,
            nombre: 'Santa Fe',
            descripcion: path.includes('tipoclave') ? 'CUIT' : 'Empresa',
          },
        ],
      });
    }
    if (path === '/api/actividades') return route.fulfill({ json: activities });
    if (path === '/api/bancos') {
      bankQueries.push(url.search);
      const buscar = url.searchParams.get('buscar')?.toLowerCase() ?? '';
      const rows = banks.filter((x) =>
        `${x.codigoEntidad} ${x.denominacion} ${x.abreviacion}`
          .toLowerCase()
          .includes(buscar),
      );
      const p = Number(url.searchParams.get('page'));
      const size = Number(url.searchParams.get('pageSize'));
      return route.fulfill({
        json: {
          items: rows.slice((p - 1) * size, p * size),
          total: rows.length,
          page: p,
          pageSize: size,
        },
      });
    }
    if (path === '/api/empresas')
      return route.fulfill({
        json: {
          items: [...records.values()].map((x) => x.empresa),
          total: records.size,
          page: 1,
          pageSize: 25,
        },
      });
    const id = Number(path.split('/')[3]);
    if (request.method() === 'GET' && records.has(id))
      return route.fulfill({ json: records.get(id) });
    if (request.method() === 'DELETE') {
      records.delete(id);
      return route.fulfill({ status: 204 });
    }
    if (request.method() === 'POST' || request.method() === 'PUT') {
      const data: EmpresaCompletaWrite = request.postDataJSON();
      writes.push({ method: request.method(), data });
      if (writeGate) await writeGate;
      if (failWrite)
        return route.fulfill({
          status: 400,
          json: { errors: { 'empresa.claveUnica': ['Clave inválida.'] } },
        });
      const target = request.method() === 'POST' ? nextId++ : id;
      const previous = records.get(target) ?? {
        contactos: [],
        actividades: [],
        bancos: [],
      };
      const merge = <T extends { id: number }>(
        old: T[],
        changed: (Omit<T, 'id'> & { id: number | null })[],
        deleted: number[],
      ) => [
        ...old.filter(
          (x) => !deleted.includes(x.id) && !changed.some((c) => c.id === x.id),
        ),
        ...changed.map((x) => ({ ...x, id: x.id ?? nextDetailId++ }) as T),
      ];
      const value: EmpresaCompleta = {
        empresa: { ...data.empresa, id: target },
        contactos: merge(
          previous.contactos,
          data.contactos.map((x) => ({ ...x, idEmpresa: target })),
          data.contactosEliminar,
        ),
        actividades: merge(
          previous.actividades,
          data.actividades.map((x) => ({
            ...x,
            idEmpresa: target,
            codigoAfip: 100 + (x.idActividad ?? 0),
            actividad: `Actividad ${x.idActividad}`,
          })),
          data.actividadesEliminar,
        ),
        bancos: merge(
          previous.bancos,
          data.bancos.map((x) => ({
            ...x,
            idEmpresa: target,
            banco: banks[x.idBanco - 1].denominacion,
            abreviacion: banks[x.idBanco - 1].abreviacion,
          })),
          data.bancosEliminar,
        ),
      };
      records.set(target, value);
      return route.fulfill({
        status: request.method() === 'POST' ? 201 : 200,
        json: value,
      });
    }
    throw new Error('Unexpected route: ' + path);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const menu = page.getByRole('button', { name: 'Menú', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Empresas', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Empresas', exact: true }),
  ).toBeVisible({ timeout: 30000 });
  return {
    records,
    writes,
    bankQueries,
    fail: (value: boolean) => {
      failWrite = value;
    },
    gate: (value: Promise<void> | null) => {
      writeGate = value;
    },
    catalogs: (value: Promise<void> | null) => {
      catalogGate = value;
    },
  };
}

test('Root, multi-selection, atomic draft, three saves, undo and cancellation', async ({
  page,
}, info) => {
  const api = await fixture(page);
  let release!: () => void;
  api.catalogs(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Nueva empresa' });
  await expect(
    form.getByRole('button', { name: 'Guardar y cerrar', exact: true }),
  ).toBeDisabled();
  await expect(form.locator('.empresa-root')).toBeVisible();
  await page.screenshot({
    path: info.outputPath('empresa-loading.png'),
    fullPage: true,
  });
  release();
  await form.getByLabel('Nombre', { exact: true }).fill('Empresa de prueba');
  await form.getByLabel('Código', { exact: true }).fill('12');
  await form.getByLabel('Provincia', { exact: true }).selectOption('1');
  await form.getByRole('tab', { name: 'Actividades (0)' }).focus();
  const controls = await form
    .locator('.empresa-root input, .empresa-root select')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        return {
          height: style.height,
          font: style.fontFamily,
          background: style.backgroundColor,
          border: style.borderColor,
        };
      }),
    );
  expect(new Set(controls.map((x) => JSON.stringify(x))).size).toBe(1);
  const rootOverflow = await form
    .locator('.empresa-root')
    .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(rootOverflow).toBe(false);
  await expect(
    form.getByRole('tab', { name: 'Actividades (0)' }),
  ).toHaveAttribute('aria-selected', 'true');
  await form
    .getByRole('button', { name: 'Agregar actividades', exact: true })
    .click();
  const activities = page.getByRole('dialog', { name: 'Agregar actividades' });
  await activities.getByLabel('Buscar actividades').fill('sin-coincidencias');
  await expect(
    activities.getByText('No hay opciones para mostrar.'),
  ).toBeVisible();
  await activities
    .getByRole('button', { name: 'Limpiar búsqueda', exact: true })
    .click();
  await activities
    .getByRole('row')
    .filter({ hasText: 'Actividad 1' })
    .getByRole('checkbox')
    .check();
  await activities
    .getByRole('row')
    .filter({ hasText: 'Actividad 2' })
    .getByRole('checkbox')
    .check();
  await activities
    .getByRole('button', { name: 'Agregar seleccionadas (2)' })
    .click();
  await expect(
    form.getByRole('tab', { name: 'Actividades (2)' }),
  ).toBeVisible();
  await form
    .getByLabel('Valor del seguro')
    .first()
    .fill('123456789012345.6789');
  await expect(
    form.getByLabel('Activo', { exact: true }).first(),
  ).not.toBeChecked();
  await page.screenshot({
    path: info.outputPath('empresa-actividades.png'),
    fullPage: true,
  });
  if (info.project.name === 'desktop') {
    const row = form.locator('.empresa-detail-card').first();
    const data = await row.locator('.empresa-detail-data').boundingBox();
    const action = await row.locator('.empresa-detail-actions').boundingBox();
    expect(action!.x).toBeGreaterThan(data!.x + data!.width - 1);
    expect((await row.boundingBox())!.height).toBeLessThan(100);
  }
  await form.getByRole('tab', { name: 'Bancos (0)' }).click();
  await form
    .getByRole('button', { name: 'Agregar bancos', exact: true })
    .click();
  const banks = page.getByRole('dialog', { name: 'Agregar bancos' });
  await banks.getByLabel('Buscar bancos').fill('sin-coincidencias');
  await expect(banks.getByText('No hay opciones para mostrar.')).toBeVisible();
  await banks
    .getByRole('button', { name: 'Limpiar búsqueda', exact: true })
    .click();
  await expect(banks.getByLabel('Buscar bancos')).toHaveValue('');
  await banks
    .getByRole('row')
    .filter({ hasText: 'Banco 01' })
    .getByRole('checkbox')
    .check();
  await banks.getByRole('button', { name: 'Página siguiente' }).click();
  await banks
    .getByRole('row')
    .filter({ hasText: 'Banco 26' })
    .getByRole('checkbox')
    .check();
  await banks.getByLabel('Buscar bancos').fill('Banco 30');
  await banks
    .getByRole('row')
    .filter({ hasText: 'Banco 30' })
    .getByRole('checkbox')
    .check();
  await expect(
    banks.getByRole('button', { name: 'Agregar seleccionadas (3)' }),
  ).toBeEnabled();
  await banks
    .getByRole('button', { name: 'Agregar seleccionadas (3)' })
    .click();
  await page.screenshot({
    path: info.outputPath('empresa-bancos.png'),
    fullPage: true,
  });
  expect(
    api.bankQueries.some(
      (x) => x.includes('buscar=Banco+30') || x.includes('buscar=Banco%2030'),
    ),
  ).toBe(true);
  await form.getByRole('tab', { name: 'Contactos (0)' }).click();
  await form
    .getByRole('button', { name: 'Agregar contacto', exact: true })
    .click();
  await form.getByLabel('Nombre del contacto').fill('Administración');
  expect(api.writes).toHaveLength(0);
  await page.screenshot({
    path: info.outputPath('empresa-contactos.png'),
    fullPage: true,
  });
  expect(
    await form.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  const axe = await new AxeBuilder({ page }).include('dialog[open]').analyze();
  expect(axe.violations).toEqual([]);
  await form.getByRole('button', { name: 'Guardar', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Editar empresa' });
  await expect(edit).toBeVisible();
  expect(api.writes).toHaveLength(1);
  expect(api.writes[0].data.actividades[0].valorSeguro).toBe(
    '123456789012345.6789',
  );
  expect(api.writes[0].data.bancos.map((x) => x.idBanco)).toEqual([1, 26, 30]);
  await edit.getByLabel('Nombre', { exact: true }).fill('Descartar');
  await edit.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(edit.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Empresa de prueba',
  );
  await edit
    .getByRole('button', { name: 'Guardar y nuevo', exact: true })
    .click();
  await expect(form).toBeVisible();
  await expect(form.getByLabel('Nombre', { exact: true })).toHaveValue('');
  expect(api.writes[1].method).toBe('PUT');
  expect(api.writes[1].data.actividades).toEqual([]);
  await form.getByLabel('Nombre', { exact: true }).fill('Segunda empresa');
  await form
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(form).not.toBeVisible();
  expect(api.records.size).toBe(2);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await form.getByLabel('Nombre', { exact: true }).fill('No persistir');
  await form.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(form.getByLabel('Nombre', { exact: true })).toHaveValue('');
  await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.writes).toHaveLength(3);
  const row = page.getByRole('row').filter({ hasText: 'Segunda empresa' });
  await row.getByRole('button', { name: 'Eliminar', exact: true }).click();
  const confirmation = page.getByRole('dialog', {
    name: 'Confirmar eliminación',
  });
  await confirmation
    .getByRole('button', { name: 'Eliminar', exact: true })
    .click();
  await expect(confirmation).not.toBeVisible();
  expect(api.records.size).toBe(1);
});

test('write failures retain draft; pending saves block dismissal and duplicate submission', async ({
  page,
}) => {
  const api = await fixture(page);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Nueva empresa' });
  await form.getByLabel('Nombre', { exact: true }).fill('Borrador');
  await form.getByLabel('Clave única', { exact: true }).fill('inválida');
  api.fail(true);
  await form
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(form.getByText('Revisá los datos ingresados.')).toBeVisible();
  await expect(form.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Borrador',
  );
  await expect(form.getByLabel('Clave única', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  api.fail(false);
  await form.getByLabel('Clave única', { exact: true }).fill('');
  let release!: () => void;
  api.gate(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  await form
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(
    form.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeDisabled();
  await expect(form.getByLabel('Nombre', { exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(form).toBeVisible();
  expect(api.writes).toHaveLength(2);
  release();
  await expect(form).not.toBeVisible();
});

test('read-only permission hides writes', async ({ page }) => {
  const api = await fixture(page, ['empresas:read']);
  const initial = toWrite(initialFields());
  api.records.set(7, {
    empresa: { ...initial.empresa, id: 7, nombre: 'Sólo lectura' },
    contactos: [],
    actividades: [],
    bancos: [],
  });
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Nuevo', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  const view = page.getByRole('dialog', { name: 'Ver empresa' });
  await expect(view.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Sólo lectura',
  );
  await expect(view.getByLabel('Nombre', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(
    view.getByRole('button', { name: 'Guardar', exact: true }),
  ).toHaveCount(0);
  await view
    .getByRole('button', { name: 'Cerrar', exact: true })
    .last()
    .click();
  expect(api.writes).toHaveLength(0);
});

test('without delete permission, persisted details cannot be removed; unavailable catalogs preserve references', async ({
  page,
}) => {
  const api = await fixture(page, ['empresas:read', 'empresas:write']);
  api.records.set(7, {
    empresa: {
      ...toWrite(initialFields()).empresa,
      id: 7,
      nombre: 'Con referencias',
      idProvincia: 4,
      idTipoClaveUnica: 2,
      codigoPostal: 2000,
    },
    contactos: [
      {
        id: 20,
        idEmpresa: 7,
        nombre: 'Contacto',
        email: null,
        telefono: null,
        cargo: null,
      },
    ],
    actividades: [],
    bancos: [],
  });
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Editar empresa' });
  await expect(
    edit.getByRole('button', { name: 'Agregar actividades', exact: true }),
  ).toBeDisabled();
  await edit.getByRole('tab', { name: 'Contactos (1)' }).click();
  await expect(
    edit.getByRole('button', { name: 'Quitar contacto', exact: true }),
  ).toBeDisabled();
  await edit
    .getByRole('button', { name: 'Agregar contacto', exact: true })
    .click();
  await expect(
    edit.getByRole('button', { name: 'Quitar contacto', exact: true }).last(),
  ).toBeEnabled();
  await edit
    .getByRole('button', { name: 'Quitar contacto', exact: true })
    .last()
    .click();
  await edit.getByLabel('Nombre', { exact: true }).fill('Actualizada');
  await edit
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  await expect(edit).not.toBeVisible();
  expect(api.writes[0].data.empresa.idProvincia).toBe(4);
  expect(api.writes[0].data.empresa.idTipoClaveUnica).toBe(2);
  expect(api.writes[0].data.empresa.codigoPostal).toBe(2000);
  expect(api.writes[0].data.contactosEliminar).toEqual([]);
});
