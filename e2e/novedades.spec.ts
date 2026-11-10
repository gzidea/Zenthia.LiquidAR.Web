import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import type { Fila, Cambio } from '../src/features/novedades/types';
test.setTimeout(120000);
test.use({ actionTimeout: 15000 });
async function fixture(page: Page, write = true) {
  const rows: Fila[] = Array.from({ length: 2 }, (_, i) => ({
    idLegajo: i + 1,
    numero: i + 1,
    nombre: i ? 'Gómez Luis' : 'Pérez Ana',
    cuil: '20-00000000-0',
    idConvenio: 3,
    idNovedad: null,
    revision: 0,
    fechaPago: null,
    diasTrabajados: null,
    horasTrabajadas: null,
    diasVacaciones: null,
    requeridas: [{ id: 10, codigo: '310', descripcion: 'Horas extra' }],
    detalles: [],
    errores: [],
    pendientes: 1,
    idRecibo: null,
  }));
  const saves: Cambio[][] = [];
  let fail = false;
  let generated = 0;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const path = u.pathname;
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
              ? ['novedades:read', 'novedades:write']
              : ['novedades:read'],
          },
        },
      });
    expect(req.headers().authorization).toBe('Bearer test-only-access');
    if (path.endsWith('/capacidades'))
      return route.fulfill({ json: { previsualizar: write, generar: write } });
    if (path.endsWith('/catalogos/tipos-liquidacion'))
      return route.fulfill({ json: [{ id: 1, nombre: 'Mensual' }] });
    if (path.endsWith('/catalogos/convenios'))
      return route.fulfill({ json: [{ id: 3, nombre: 'Comercio' }] });
    if (path.endsWith('/empresas'))
      return route.fulfill({
        json: [
          {
            id: 1,
            nombre: 'Empresa Norte',
            legajos: 2,
            conNovedades: rows.filter((x) => x.idNovedad).length,
            recibos: generated,
          },
          {
            id: 2,
            nombre: 'Empresa Sur',
            legajos: 0,
            conNovedades: 0,
            recibos: 0,
          },
        ],
      });
    if (path.endsWith('/legajos') && req.method() === 'GET') {
      const search = u.searchParams.get('buscar') ?? '';
      const filtered =
        u.searchParams.get('idEmpresa') === '2'
          ? []
          : rows.filter((x) =>
              `${x.numero} ${x.nombre} ${x.cuil}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            );
      return route.fulfill({
        json: {
          items: filtered,
          page: 1,
          pageSize: 25,
          total: filtered.length,
          conPendientes: filtered.filter((x) => x.pendientes).length,
          conErrores: 0,
          conRecibo: generated,
        },
      });
    }
    if (path.endsWith('/guardar')) {
      const body = req.postDataJSON() as { cambios: Cambio[] };
      saves.push(body.cambios);
      if (fail) {
        fail = false;
        return route.fulfill({
          json: {
            items: body.cambios.map((x) => ({
              idLegajo: x.idLegajo,
              estado: 'error',
              error: 'Conflicto de revisión.',
            })),
          },
        });
      }
      for (const c of body.cambios) {
        const r = rows.find((x) => x.idLegajo === c.idLegajo)!;
        Object.assign(r, {
          diasTrabajados: c.diasTrabajados,
          horasTrabajadas: c.horasTrabajadas,
          diasVacaciones: c.diasVacaciones,
          fechaPago: c.fechaPago,
          idNovedad: r.idLegajo,
          revision: r.revision + 1,
        });
        r.detalles = r.detalles
          .filter(
            (d) =>
              !c.quitarFormulas.includes(d.idFormula) &&
              !c.detalles.some((x) => x.idFormula === d.idFormula),
          )
          .concat(c.detalles);
        r.pendientes = r.detalles.length ? 0 : 1;
      }
      return route.fulfill({
        json: {
          items: body.cambios.map((x) => ({
            idLegajo: x.idLegajo,
            estado: 'guardado',
            error: null,
          })),
        },
      });
    }
    if (path.endsWith('/previsualizar') || path.endsWith('/generar')) {
      const body = req.postDataJSON();
      const persistir = path.endsWith('/generar');
      const items = body.legajoIds.map((id: number) => {
        const r = rows.find((x) => x.idLegajo === id)!;
        if (r.idRecibo && persistir)
          return {
            idLegajo: id,
            estado: 'error',
            error: 'Ya existe un recibo.',
            recibo: null,
          };
        if (r.pendientes)
          return {
            idLegajo: id,
            estado: 'error',
            error: null,
            recibo: {
              calculado: false,
              persistido: false,
              cabecera: null,
              detalles: [],
              diagnosticos: [
                {
                  formulaId: 10,
                  descripcion: 'Horas extra',
                  codigo: 'NovedadRequerida',
                  mensaje: 'Falta cargar la novedad requerida.',
                  campo: 'cantidad',
                },
              ],
            },
          };
        if (persistir) {
          generated++;
          r.idRecibo = 100 + id;
        }
        return {
          idLegajo: id,
          estado: persistir ? 'generado' : 'calculado',
          error: null,
          recibo: {
            reciboId: persistir ? 100 + id : null,
            calculado: true,
            persistido: persistir,
            cabecera: {
              totalRemunerativos: '100.0000',
              totalNoRemunerativos: '0',
              totalDescuentos: '0',
              netoACobrar: '100.0000',
              totalContribuciones: '20.0000',
              totalCostoLaboral: '120.0000',
            },
            detalles: [
              {
                descripcion: 'Horas extra',
                cantidad: '2',
                base: '50',
                importe: '100',
              },
            ],
            diagnosticos: [],
          },
        };
      });
      return route.fulfill({ json: { items } });
    }
    if (path.includes('/legajos/') && req.method() === 'DELETE') {
      const id = Number(path.split('/').at(-1));
      const r = rows.find((x) => x.idLegajo === id)!;
      r.idNovedad = null;
      r.detalles = [];
      r.pendientes = 1;
      return route.fulfill({
        json: { idLegajo: id, estado: 'eliminado', error: null },
      });
    }
    if (path.endsWith('/importacion/revisar'))
      return route.fulfill({
        json: {
          cambios: [
            {
              idLegajo: 1,
              revisionEsperada: rows[0].revision,
              fechaPago: '2026-10-31',
              diasTrabajados: 30,
              horasTrabajadas: 160,
              diasVacaciones: 0,
              detalles: [
                {
                  idFormula: 10,
                  cantidad: 4,
                  importe: '123.4567',
                  observaciones: null,
                },
              ],
              quitarFormulas: [],
            },
          ],
          errores: [],
          originales: [rows[0]],
        },
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
  await page.getByRole('link', { name: 'Novedades', exact: true }).click();
  await page.getByLabel('Período', { exact: true }).fill('2026-10');
  await page
    .getByRole('combobox', { name: 'Tipo de liquidación', exact: true })
    .selectOption('1');
  await page.getByRole('button', { name: /Empresa Norte/ }).click();
  await page.getByLabel('Fecha de pago', { exact: true }).fill('2026-10-31');
  await expect(
    page.getByText('Pérez Ana', { exact: true }).first(),
  ).toBeVisible();
  return {
    rows,
    saves,
    failNext: () => {
      fail = true;
    },
    get generated() {
      return generated;
    },
  };
}
test('carga de novedades, cero explícito y editor con diseño', async ({
  page,
}, info) => {
  const state = await fixture(page);
  await page.getByLabel('Días 1', { exact: true }).fill('30');
  await expect(
    page.getByRole('button', { name: /Empresa Sur/ }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Guardar novedades (1)', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /Empresa Sur/ })).toBeEnabled();
  expect(state.saves[0][0].diasTrabajados).toBe(30);
  await page
    .getByRole('combobox', { name: 'Vista', exact: true })
    .selectOption('concepto');
  await page
    .getByRole('combobox', { name: 'Concepto', exact: true })
    .selectOption('10');
  await page.getByLabel('cantidad 1', { exact: true }).fill('0');
  await page
    .getByLabel('importe 1', { exact: true })
    .fill('1234567890123.4567');
  await page
    .getByRole('button', { name: 'Guardar novedades (1)', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /Empresa Sur/ })).toBeEnabled();
  expect(state.saves.at(-1)![0].detalles[0].importe).toBe('1234567890123.4567');
  const row = page.getByRole('row').filter({ hasText: 'Pérez Ana' });
  await expect(
    page.getByRole('button', { name: /Generar|Previsualizar|Recalcular/ }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath('novedades-trabajo.png'),
    fullPage: true,
    timeout: 60000,
  });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  await row.getByRole('button', { name: 'Editar / Ver', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(
    modal.getByRole('button', { name: 'Dejar pendiente', exact: true }),
  ).toBeEnabled();
  await expect(modal.getByLabel('Cantidad', { exact: true })).toHaveValue('0');
  await modal.screenshot({ path: info.outputPath('novedad-editor.png') });
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
});
test('conflicto conserva borrador, pegado revisado e importación confirmada', async ({
  page,
}, info) => {
  const state = await fixture(page);
  await page.getByLabel('Días 1', { exact: true }).fill('28');
  state.failNext();
  await page
    .getByRole('button', { name: 'Guardar novedades (1)', exact: true })
    .click();
  await expect(page.getByText(/Conflicto de revisión/)).toBeVisible();
  await expect(page.getByLabel('Días 1', { exact: true })).toHaveValue('28');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.getByLabel('Días 1', { exact: true })).toHaveValue('');
  await page
    .getByRole('combobox', { name: 'Vista', exact: true })
    .selectOption('concepto');
  await page
    .getByRole('combobox', { name: 'Concepto', exact: true })
    .selectOption('10');
  await page
    .getByRole('button', { name: 'Pegar desde Excel', exact: true })
    .click();
  let modal = page.getByRole('dialog');
  await modal.getByLabel('Valores desde Excel').fill('1\t2\t100.1234');
  await modal.getByRole('button', { name: 'Revisar', exact: true }).click();
  expect(state.rows[0].detalles).toHaveLength(0);
  await modal
    .getByRole('button', { name: 'Aplicar al borrador', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Guardar novedades (1)', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /Empresa Sur/ })).toBeEnabled();
  await page
    .getByRole('combobox', { name: 'Convenio', exact: true })
    .selectOption('3');
  await page.getByLabel('Revisar Excel').setInputFiles({
    name: 'fixture.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('fixture'),
  });
  modal = page.getByRole('dialog');
  await expect(
    page.getByRole('dialog', { name: 'Revisión de importación' }),
  ).toBeVisible();
  expect(state.rows[0].detalles[0].cantidad).toBe(2);
  await modal.screenshot({
    path: info.outputPath('novedades-importacion.png'),
  });
  await modal
    .getByRole('button', { name: 'Confirmar y guardar', exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  expect(state.rows[0].detalles[0].cantidad).toBe(4);
});
test('consulta sin permisos de escritura', async ({ page }) => {
  await fixture(page, false);
  await expect(page.getByLabel('Días 1', { exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: /Guardar novedades/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Generar seleccionados', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('row')
    .filter({ hasText: 'Pérez Ana' })
    .getByRole('button', { name: 'Ver', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'Guardar y cerrar', exact: true }),
  ).toHaveCount(0);
});
