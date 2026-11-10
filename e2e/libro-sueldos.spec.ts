import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import {
  type Libro,
  type Concepto,
  type Asignacion,
  type Registro04,
} from '../src/features/libro-sueldos/types';
import { fields04 } from '../src/features/libro-sueldos/fields';

test.setTimeout(180000);
test('Libro de sueldo: guardado, detalles, códigos por empresa y acciones responsive', async ({
  page,
}, info) => {
  let book: Libro | null = null;
  let rejectNextSave = false;
  let rejectNextExport = true;
  const conceptos: Concepto[] = [];
  const asignaciones: Asignacion[] = [];
  const writes: { method: string; path: string }[] = [];
  const refs = {
    opciones: {
      empresas: [{ id: 2, nombre: 'Empresa A', codigo: '30000000001' }],
      envios: [{ id: 1, nombre: 'Sueldos', codigo: 'SJ' }],
      tipos: [{ id: 1, nombre: 'Mensual', codigo: 'M' }],
      formulas: [{ id: 8, nombre: 'Básico', codigo: '42' }],
      bancos: [{ id: 1, nombre: 'Banco sintético' }],
      legajos: [
        { id: 7, nombre: 'Trabajador de prueba', codigo: '20000000001' },
      ],
    },
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
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
            permissions: ['ls.read', 'ls.write', 'ls.delete'],
          },
        },
      });
    if (path === '/api/liquidaciones/capacidades')
      return route.fulfill({ json: { leer: false, generar: false } });
    if (path === '/api/libro-sueldos/referencias')
      return route.fulfill({ json: refs });
    if (!path.startsWith('/api/libro-sueldos'))
      return route.fulfill({ status: 404, json: {} });
    expect(request.headers().authorization).toBe('Bearer test-only-access');
    if (method !== 'GET') writes.push({ method, path });
    if (path.endsWith('/configuracion'))
      return route.fulfill({ json: { conceptos, asignaciones } });
    if (path.includes('/conceptos')) {
      const value = request.postDataJSON() as Concepto;
      const saved = {
        ...value,
        id: value.id || conceptos.length + 1,
        version: value.version + 1,
      };
      const index = conceptos.findIndex((c) => c.id === saved.id);
      if (index < 0) conceptos.push(saved);
      else conceptos[index] = saved;
      return route.fulfill({ json: saved });
    }
    if (path.includes('/asignaciones')) {
      const value = request.postDataJSON() as Asignacion;
      const saved = {
        ...value,
        id: value.id || asignaciones.length + 1,
        version: value.version + 1,
      };
      const index = asignaciones.findIndex((c) => c.id === saved.id);
      if (index < 0) asignaciones.push(saved);
      else asignaciones[index] = saved;
      return route.fulfill({ json: saved });
    }
    if (path === '/api/libro-sueldos' && method === 'GET')
      return route.fulfill({
        json: {
          items: book
            ? [
                {
                  ...book.cabecera,
                  empresa: 'Empresa A',
                  tipoLiquidacion: 'Mensual',
                },
              ]
            : [],
          page: 1,
          pageSize: 25,
          total: book ? 1 : 0,
        },
      });
    if (path === '/api/libro-sueldos' && method === 'POST') {
      book = request.postDataJSON() as Libro;
      book.cabecera.id = 1;
      book.cabecera.version = 1;
    }
    if (path.endsWith('/cobertura'))
      return route.fulfill({
        json: [
          {
            idFormula: 8,
            descripcion: 'Básico',
            codigo: '42',
            origen: 'Formula',
            codigoArca: null,
            idAsignacion: null,
            error: null,
          },
        ],
      });
    if (!book) return route.fulfill({ status: 404 });
    if (path.endsWith('/eventos')) return route.fulfill({ json: [] });
    if (path.endsWith('/diagnostico'))
      return route.fulfill({
        json: {
          version: book.cabecera.version,
          consultadoEn: '2026-11-03T12:00:00Z',
          exhaustivo: false,
          problemas: [],
        },
      });
    if (
      path.endsWith('/generar') ||
      (path === '/api/libro-sueldos' && method === 'POST')
    ) {
      book.cabecera.generado = true;
      book.cabecera.cantidadDeRegistros04 = 1;
      book.cabecera.version++;
      book.registros02 = [
        {
          id: 1,
          idLSDRegistro01: 1,
          idLegajo: 7,
          dependenciaRevista: null,
          cantDiasProporcionarTope: 0,
          fechaDePago: '20261031',
        },
      ];
      book.registros03 = [
        {
          id: 2,
          idLSDRegistro01: 1,
          cuil: '20000000001',
          codigoConcepto: '42',
          cantidad: '1.25',
          unidad: 'D',
          importe: '123.45',
          debitoCredito: 'C',
          periodoAjuste: null,
          idFormulaOrigen: 8,
          idAsignacionOrigen: null,
          origenCodigo: 'Formula',
        },
      ];
      book.registros04 = [
        {
          ...Object.fromEntries(
            fields04.map((f) => [
              f.name,
              f.kind === 'boolean'
                ? false
                : f.kind === 'decimal'
                  ? '0'
                  : f.kind === 'integer'
                    ? 0
                    : null,
            ]),
          ),
          id: 3,
          idLSDRegistro01: 1,
          cuil: '20000000001',
        } as unknown as Registro04,
      ];
      return route.fulfill({
        status: path.endsWith('/generar') ? 200 : 201,
        json: book,
      });
    }
    if (path.endsWith('/exportar')) {
      if (rejectNextExport) {
        rejectNextExport = false;
        return route.fulfill({ status: 400, json: { errors: { cantidad: [
          'Línea 5 · Registro 03 · Concepto 1002 · Campo cantidad: Posiciones 24–28. Valor 1200: requiere 6 posiciones (120000); admite 5 posiciones.',
          'Línea 8 · Registro 03 · Concepto 11 · Campo cantidad: Posiciones 24–28. Valor 1200: requiere 6 posiciones (120000); admite 5 posiciones.',
        ] } } });
      }
      book.cabecera.exportado = true;
      book.cabecera.version++;
      return route.fulfill({
        body: '01archivo de prueba\r\n03',
        headers: {
          'content-type': 'text/plain',
          'content-disposition':
            'attachment; filename="300000000011020263.txt"',
        },
      });
    }
    if (path.endsWith('/pago')) {
      const data = request.postDataJSON();
      book.cabecera.fechaPago = data.fechaPago;
      book.cabecera.idBanco = data.idBanco;
      book.cabecera.version++;
      return route.fulfill({ json: book });
    }
    if (method === 'PUT') {
      if (rejectNextSave) {
        rejectNextSave = false;
        return route.fulfill({
          status: 409,
          json: { title: 'La versión cambió.' },
        });
      }
      book = request.postDataJSON() as Libro;
      book.cabecera.version++;
      return route.fulfill({ json: book });
    }
    if (method === 'DELETE') {
      book = null;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: book });
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await page
    .getByRole('link', { name: 'Libro de sueldo', exact: true })
    .click();
  await expect(
    page.getByText('No hay libros de sueldo para mostrar.'),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Nuevo libro de sueldo' });
  await expect(
    dialog.getByRole('group', { name: 'Registros del libro' }),
  ).toHaveCount(0);
  await expect(dialog.getByLabel('Cantidad registros 04')).toHaveCount(0);
  await dialog.getByLabel('Empresa', { exact: true }).selectOption('2');
  await dialog
    .getByLabel('Identificación del envío', { exact: true })
    .selectOption('1');
  await dialog
    .getByLabel('Tipo de liquidación', { exact: true })
    .selectOption('1');
  await dialog.getByLabel('Período (MMAAAA)', { exact: true }).fill('102026');
  await dialog.getByLabel('N.º liquidación', { exact: true }).fill('2');
  await page.screenshot({
    path: info.outputPath('libro-formulario.png'),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Editar libro de sueldo' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Registro 02', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText('Cantidad registros 04:')).toContainText('1');
  await expect(
    dialog.getByRole('row', { name: /Trabajador de prueba/ }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('libro-edicion.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    writes.filter(
      (w) => w.method === 'POST' && w.path === '/api/libro-sueldos',
    ),
  ).toHaveLength(1);
  expect(
    writes.some((w) => w.method === 'PUT' && w.path === '/api/libro-sueldos/1'),
  ).toBe(true);
  await page.getByRole('button', { name: 'Generar', exact: true }).click();
  await expect(
    page.getByText('Código de fórmula', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Editar libro de sueldo' });
  await dialog
    .getByRole('button', { name: 'Registro 03', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Editar', exact: true }).click();
  const detalle = page.getByRole('dialog', { name: 'Editar registro 03' });
  await expect(detalle.getByLabel('Informar cantidad en TXT', { exact: true })).toBeChecked();
  await detalle.getByLabel('Informar cantidad en TXT', { exact: true }).uncheck();
  await detalle.getByLabel('Importe', { exact: true }).fill('234.56');
  await page.screenshot({ path: info.outputPath('registro03-cantidad.png'), fullPage: true });
  await detalle.getByRole('button', { name: 'Aplicar al borrador' }).click();
  await dialog.getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect.poll(() => book?.registros03[0]?.importe).toBe('234.56');
  await expect.poll(() => book?.registros03[0]?.informarCantidadLsd).toBe(false);
  await page.getByRole('button', { name: 'Exportar TXT', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('listitem').filter({ hasText: 'Línea 5' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('listitem').filter({ hasText: 'Línea 8' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('errores-posicionales.png'), fullPage: true });
  const download = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain('.txt');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Registrar pago', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: 'Registrar pago' });
  await dialog.getByLabel('Banco de la empresa').selectOption('1');
  await dialog.getByLabel('Fecha de pago (AAAA-MM-DD)').fill('2026-10-31');
  await dialog
    .getByRole('button', { name: 'Registrar pago', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Configuración de conceptos' })
    .click();
  dialog = page.getByRole('dialog', { name: 'Configuración de conceptos LSD' });
  await dialog.getByLabel('Empresa', { exact: true }).selectOption('2');
  await dialog.getByRole('button', { name: 'Nuevo concepto' }).click();
  let form = page.getByRole('dialog', { name: 'Nuevo concepto del empleador' });
  await form.getByLabel('Código del empleador').fill('0010');
  await form.getByLabel('Descripción', { exact: true }).fill('Básico anterior');
  await form.getByLabel('Clasificación ARCA').fill('110000');
  await form.getByRole('button', { name: 'Guardar', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Editar concepto del empleador' });
  await expect(form).toBeVisible();
  await form
    .getByLabel('Descripción', { exact: true })
    .fill('Borrador sin guardar');
  await form.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(form.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Básico anterior',
  );
  await form.getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(
    dialog.getByRole('cell', { name: '0010', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Nueva asignación' }).click();
  form = page.getByRole('dialog', { name: 'Nueva asignación de fórmula' });
  await form.getByLabel('Fórmula', { exact: true }).selectOption('8');
  await form
    .getByLabel('Concepto del empleador', { exact: true })
    .selectOption('1');
  await form.getByLabel('Desde (AAAAMM)').fill('202601');
  await form.getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(
    dialog.getByRole('cell', { name: '202601', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('libro-configuracion.png'),
    fullPage: true,
  });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.screenshot({
    path: info.outputPath('libro-listado.png'),
    fullPage: true,
  });
  for (const action of ['Guardar y nuevo', 'Guardar y cerrar']) {
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Nuevo libro de sueldo' });
    await create.getByLabel('Empresa', { exact: true }).selectOption('2');
    await create
      .getByLabel('Identificación del envío', { exact: true })
      .selectOption('1');
    await create
      .getByLabel('Tipo de liquidación', { exact: true })
      .selectOption('1');
    await create.getByLabel('Período (MMAAAA)', { exact: true }).fill('102026');
    const before = writes.filter(
      (w) => w.method === 'POST' && w.path === '/api/libro-sueldos',
    ).length;
    await create.getByRole('button', { name: action, exact: true }).click();
    await expect
      .poll(
        () =>
          writes.filter(
            (w) => w.method === 'POST' && w.path === '/api/libro-sueldos',
          ).length,
      )
      .toBe(before + 1);
    await expect.poll(() => book?.cabecera.generado).toBe(true);
    if (action === 'Guardar y nuevo') {
      await expect(create.getByLabel('Empresa', { exact: true })).toHaveValue(
        '',
      );
      await expect(
        create.getByRole('group', { name: 'Registros del libro' }),
      ).toHaveCount(0);
      await create
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const conflictForm = page.getByRole('dialog', {
    name: 'Editar libro de sueldo',
  });
  const persistedNumber = await conflictForm
    .getByLabel('N.º liquidación', { exact: true })
    .inputValue();
  await conflictForm.getByLabel('N.º liquidación', { exact: true }).fill('17');
  rejectNextSave = true;
  await conflictForm
    .getByRole('button', { name: 'Guardar y cerrar', exact: true })
    .click();
  const compare = conflictForm.getByRole('button', {
    name: 'Consultar versión guardada',
    exact: true,
  });
  await expect(compare).toBeVisible();
  await compare.focus();
  await page.keyboard.press('Enter');
  await expect(
    conflictForm.getByRole('table', { name: 'Diferencias entre versiones' }),
  ).toContainText('17');
  await expect(
    conflictForm.getByLabel('N.º liquidación', { exact: true }),
  ).toHaveValue('17');
  expect(
    await conflictForm.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include('dialog').analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath('libro-comparar-versiones.png'),
    fullPage: true,
  });
  await conflictForm
    .getByRole('button', {
      name: 'Descartar borrador y cargar versión guardada',
      exact: true,
    })
    .click();
  await expect(
    conflictForm.getByLabel('N.º liquidación', { exact: true }),
  ).toHaveValue(persistedNumber);
  await conflictForm
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
});
