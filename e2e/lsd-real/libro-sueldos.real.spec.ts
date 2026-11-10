import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loginResponse } from '../../src/test/fixtures';
import type { Libro } from '../../src/features/libro-sueldos/types';

const token = process.env.LSD_ACCESS_TOKEN;
if (!token)
  throw new Error('The synthetic host must provide LSD_ACCESS_TOKEN.');
const headers = { Authorization: `Bearer ${token}` };

async function login(page: Page) {
  // Only Security is simulated. Every LiquidAR business request reaches the real API/database.
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({ json: loginResponse({ accessToken: token, userId: 1 }) }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route('**/api/users/me', (route) =>
    route.fulfill({
      json: {
        actor: {
          userId: 1,
          tenantId: 1,
          applicationId: 1,
          isSuperAdmin: false,
          permissions: ['ls.read', 'ls.write', 'ls.delete'],
        },
      },
    }),
  );
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('lsd-sintetico');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Synthetic-test-only');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await page
    .getByRole('link', { name: 'Libro de sueldo', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Nuevo', exact: true }),
  ).toBeVisible();
}

async function createForm(page: Page, period = '102026', number = '2') {
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Nuevo libro de sueldo' });
  await form.getByLabel('Empresa', { exact: true }).selectOption('2');
  await form
    .getByLabel('Identificación del envío', { exact: true })
    .selectOption('1');
  await form
    .getByLabel('Tipo de liquidación', { exact: true })
    .selectOption('1');
  await form.getByLabel('Período (MMAAAA)', { exact: true }).fill(period);
  await form.getByLabel('N.º liquidación', { exact: true }).fill(number);
  return form;
}

async function detail(page: Page, id: number): Promise<Libro> {
  const response = await page.request.get(`/api/libro-sueldos/${id}`, {
    headers,
  });
  expect(response.status()).toBe(200);
  return response.json();
}

function apiResponse(page: Page, method: string, path: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      new URL(response.url()).pathname === path,
  );
}

test('alta, edición manual, TXT real y pago persisten en PostgreSQL', async ({
  page,
}, info) => {
  await login(page);
  const create = await createForm(page);
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/libro-sueldos') && r.request().method() === 'POST',
  );
  await create.getByRole('button', { name: 'Guardar', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const book: Libro = await response.json();
  expect(book.registros04).toHaveLength(1);
  const form = page.getByRole('dialog', { name: 'Editar libro de sueldo' });
  await form.getByRole('button', { name: 'Registro 03', exact: true }).click();
  await form.getByRole('button', { name: 'Editar', exact: true }).click();
  const row = page.getByRole('dialog', { name: 'Editar registro 03' });
  await row.getByLabel('Importe', { exact: true }).fill('234.56');
  await row.getByRole('button', { name: 'Aplicar al borrador' }).click();
  const updated = apiResponse(
    page,
    'PUT',
    `/api/libro-sueldos/${book.cabecera.id}`,
  );
  await form.getByRole('button', { name: 'Guardar y cerrar' }).click();
  expect((await updated).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await detail(page, book.cabecera.id)).registros03[0].importe).toMatch(
    /^234\.560*$/,
  );
  const diagnosed = apiResponse(
    page,
    'GET',
    `/api/libro-sueldos/${book.cabecera.id}/diagnostico`,
  );
  await page.getByRole('button', { name: 'Exportar TXT', exact: true }).click();
  expect((await diagnosed).status()).toBe(200);
  await expect(
    page.getByRole('region', { name: 'Diagnóstico previo' }),
  ).toContainText('Revisión orientativa');
  const download = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  const file = await download;
  const bytes = await readFile((await file.path())!);
  expect(
    bytes
      .toString('latin1')
      .split('\r\n')
      .map((line) => line.length),
  ).toEqual([35, 115, 51, 370]);
  expect(bytes.toString('latin1').split('\r\n')[2].slice(29, 44)).toBe(
    '000000000023456',
  );
  expect(bytes.at(-1)).not.toBe(10);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Registrar pago', exact: true })
    .click();
  const pay = page.getByRole('dialog', { name: 'Registrar pago' });
  await pay.getByLabel('Banco de la empresa').selectOption('1');
  await pay.getByLabel('Fecha de pago (AAAA-MM-DD)').fill('2026-10-31');
  const paid = apiResponse(
    page,
    'POST',
    `/api/libro-sueldos/${book.cabecera.id}/pago`,
  );
  await pay
    .getByRole('button', { name: 'Registrar pago', exact: true })
    .click();
  expect((await paid).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = await detail(page, book.cabecera.id);
  expect(saved.cabecera.exportado).toBe(true);
  expect(saved.cabecera.idBanco).toBe(1);
  expect(saved.cabecera.fechaPago).toContain('2026-10-31');
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  await page.getByText('Historial y exportaciones', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('SHA-256:');
  await expect(page.getByRole('dialog')).toContainText(
    'La versión actual cambió',
  );
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.screenshot({
    path: info.outputPath('libro-persistido.png'),
    fullPage: true,
  });
});

test('alta fallida conserva formulario y no deja cabecera ni detalles', async ({
  page,
}) => {
  await login(page);
  const form = await createForm(page, '112026');
  const rejected = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/libro-sueldos') && r.request().method() === 'POST',
  );
  await form.getByRole('button', { name: 'Guardar', exact: true }).click();
  expect((await rejected).status()).toBe(400);
  await expect(form).toBeVisible();
  await expect(
    form.getByLabel('Período (MMAAAA)', { exact: true }),
  ).toHaveValue('112026');
  const list = await page.request.get(
    '/api/libro-sueldos?empresaId=2&periodo=112026',
    { headers },
  );
  expect((await list.json()).total).toBe(0);
  await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
});

test('dos sesiones conservan el borrador cuando la segunda recibe 409', async ({
  page,
  browser,
}) => {
  await login(page);
  const response = await page.request.post('/api/libro-sueldos', {
    headers,
    data: {
      cabecera: {
        idEmpresa: 2,
        idIdentificacionEnvio: 1,
        periodo: '102026',
        idTipoLiquidacion: 1,
        numeroDeLiquidacion: 9,
        diasBases: 30,
      },
    },
  });
  expect(response.status()).toBe(201);
  const book: Libro = await response.json();
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  const secondContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:5178',
  });
  try {
    const second = await secondContext.newPage();
    await login(second);
    for (const tab of [page, second]) {
      const row = tab
        .getByRole('row')
        .filter({ has: tab.getByRole('cell', { name: '9', exact: true }) });
      await row.getByRole('button', { name: 'Editar', exact: true }).click();
      const dialog = tab.getByRole('dialog', {
        name: 'Editar libro de sueldo',
      });
      await dialog
        .getByRole('button', { name: 'Registro 02', exact: true })
        .click();
      await dialog.getByRole('button', { name: 'Editar', exact: true }).click();
      const record = tab.getByRole('dialog', { name: 'Editar registro 02' });
      await record
        .getByLabel('Dependencia de revista', { exact: true })
        .fill(tab === page ? 'Primera sesión' : 'Borrador segunda sesión');
      await record.getByRole('button', { name: 'Aplicar al borrador' }).click();
    }
    const firstSaved = apiResponse(
      page,
      'PUT',
      `/api/libro-sueldos/${book.cabecera.id}`,
    );
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Guardar y cerrar' })
      .click();
    expect((await firstSaved).status()).toBe(200);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const conflict = second.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' &&
        r.url().endsWith(`/api/libro-sueldos/${book.cabecera.id}`),
    );
    await second
      .getByRole('dialog')
      .getByRole('button', { name: 'Guardar y cerrar' })
      .click();
    expect((await conflict).status()).toBe(409);
    await expect(
      second.getByRole('dialog', { name: 'Editar libro de sueldo' }),
    ).toBeVisible();
    expect(
      (await detail(page, book.cabecera.id)).registros02[0].dependenciaRevista,
    ).toBe('Primera sesión');
    await second
      .getByRole('dialog')
      .getByRole('button', { name: 'Editar', exact: true })
      .click();
    await expect(
      second
        .getByRole('dialog', { name: 'Editar registro 02' })
        .getByLabel('Dependencia de revista', { exact: true }),
    ).toHaveValue('Borrador segunda sesión');
    await second
      .getByRole('dialog', { name: 'Editar registro 02' })
      .getByRole('button', { name: 'Cancelar', exact: true })
      .click();
    await second
      .getByRole('button', { name: 'Consultar versión guardada', exact: true })
      .click();
    await expect(
      second.getByRole('table', { name: 'Diferencias entre versiones' }),
    ).toContainText('Borrador segunda sesión');
    await expect(
      second.getByRole('table', { name: 'Diferencias entre versiones' }),
    ).toContainText('Primera sesión');
    await second
      .getByRole('button', {
        name: 'Descartar borrador y cargar versión guardada',
        exact: true,
      })
      .click();
    await second
      .getByRole('dialog')
      .getByRole('button', { name: 'Editar', exact: true })
      .click();
    await expect(
      second
        .getByRole('dialog', { name: 'Editar registro 02' })
        .getByLabel('Dependencia de revista', { exact: true }),
    ).toHaveValue('Primera sesión');
  } finally {
    await secondContext.close();
  }
});

test('respuesta de alta perdida consulta lo persistido sin repetir el POST', async ({
  page,
}) => {
  await login(page);
  let posts = 0;
  await page.route('**/api/libro-sueldos', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++;
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await route.abort('failed');
  });
  const form = await createForm(page, '102026', '20');
  const interrupted = page.waitForEvent(
    'requestfailed',
    (request) =>
      request.method() === 'POST' &&
      request.url().endsWith('/api/libro-sueldos'),
  );
  await form.getByRole('button', { name: 'Guardar', exact: true }).click();
  await interrupted;
  await expect(
    form.getByRole('region', { name: 'Recuperar operación incierta' }),
  ).toBeVisible();
  await expect(
    form.getByRole('button', { name: 'Guardar y cerrar', exact: true }),
  ).toBeDisabled();
  await form
    .getByRole('button', { name: 'Consultar estado persistido', exact: true })
    .click();
  await expect(
    form.getByRole('region', { name: 'Recuperar operación incierta' }),
  ).toContainText('N.º 20');
  expect(posts).toBe(1);
  await expect(form.getByLabel('N.º liquidación', { exact: true })).toHaveValue(
    '20',
  );
  const result = await page.request.get(
    '/api/libro-sueldos?empresaId=2&periodo=102026',
    { headers },
  );
  expect(
    (await result.json()).items.filter(
      (b: { numeroDeLiquidacion: number }) => b.numeroDeLiquidacion === 20,
    ),
  ).toHaveLength(1);
});
