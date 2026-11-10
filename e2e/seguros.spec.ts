import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
test.setTimeout(60_000);

test('seguros: valores oficiales, contrato de empresa y cobertura SCVO con revisiones', async ({
  page,
}, info) => {
  const oficiales: unknown[] = [],
    empresas: unknown[] = [],
    legajos: unknown[] = [];
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path === '/api/auth/login')
      return route.fulfill({ json: loginResponse({ isSuperAdmin: true }) });
    if (path === '/api/empresas/selector')
      return route.fulfill({
        json: {
          items: [
            {
              id: 2,
              codigo: 2,
              nombre: 'Empresa de prueba',
              claveUnica: '30-00000000-1',
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        },
      });
    if (path === '/api/empresas/2/completa')
      return route.fulfill({
        json: {
          empresa: { id: 2, nombre: 'Empresa de prueba' },
          contactos: [],
          actividades: [],
          bancos: [],
        },
      });
    if (path === '/api/users/me')
      return route.fulfill({
        json: {
          actor: {
            userId: 7,
            tenantId: 2,
            applicationId: 42,
            isSuperAdmin: true,
            permissions: [],
          },
        },
      });
    if (path === '/api/configuracion/formulas-empresa')
      return route.fulfill({
        json: {
          enabled: false,
          puedeLeer: false,
          puedeEscribir: false,
          puedeEscribirCentral: false,
        },
      });
    if (path === '/api/liquidaciones/capacidades')
      return route.fulfill({
        json: { leer: false, generar: false, corregirNovedades: false },
      });
    if (path === '/api/empresas')
      return route.fulfill({
        json: {
          items: [
            {
              id: 2,
              codigo: 2,
              nombre: 'Empresa de prueba',
              claveUnica: '30-00000000-1',
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        },
      });
    if (path === '/api/legajos')
      return route.fulfill({
        json: {
          items: [
            {
              id: 7,
              legajo: 7,
              idEmpresa: 2,
              nombres: 'Ana',
              apellidos: 'Prueba',
              empresaNombre: 'Empresa de prueba',
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        },
      });
    if (path.startsWith('/api/legajos/catalogos/'))
      return route.fulfill({ json: [{ id: 2, nombre: 'Empresa de prueba' }] });
    const rows =
      path === '/api/seguros/parametros'
        ? oficiales
        : path === '/api/empresas/2/seguros'
          ? empresas
          : path === '/api/legajos/7/seguros'
            ? legajos
            : null;
    if (rows) {
      if (request.method() === 'GET') return route.fulfill({ json: rows });
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push({ path, body });
      const { vigencia, ...fields } = body;
      const v = vigencia as {
        periodoDesde: string;
        periodoHasta: string | null;
        motivo: string;
        revisionEsperada: number;
      };
      const date = (p: string) => `${p.slice(2)}-${p.slice(0, 2)}-01`;
      const row = {
        ...fields,
        version: {
          id: rows.length + 1,
          revision: v.revisionEsperada + 1,
          desde: date(v.periodoDesde),
          hasta: v.periodoHasta ? date(v.periodoHasta) : null,
          motivo: v.motivo,
          creadoEn: '2026-10-28T12:00:00Z',
          creadoPor: 7,
        },
      };
      rows.push(row);
      return route.fulfill({ json: row });
    }
    throw new Error(`Unexpected ${path}`);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Test123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app$/);
  // The actual routes are used; only HTTP responses are fixtures.
  if (info.project.name === 'mobile')
    await page.locator('.sidebar-toggle').click();
  await page
    .locator('#app-sidebar')
    .getByRole('button', { name: 'Empresas', exact: true })
    .click();
  await page
    .locator('#app-sidebar')
    .getByRole('link', { name: 'Empresas', exact: true })
    .click();
  await expect(
    page.getByRole('cell', { name: 'Empresa de prueba', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Valores SCVO / FFEP', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Seguros SCVO / ART', exact: true }),
  ).toHaveCount(0);
  if (info.project.name === 'mobile')
    await page.locator('.sidebar-toggle').click();
  await page
    .getByRole('link', { name: 'Valores Generales SCVO / FFEP' })
    .click();
  await expect(page.getByText('No hay configuración publicada.')).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Importe oficial ($)').fill('100.1234');
  await dialog
    .getByLabel('Fuente normativa')
    .fill('Fuente de prueba; no valor legal');
  await dialog.getByLabel('Período desde').fill('2026-11');
  await dialog.getByLabel('Motivo de la publicación').fill('Prueba');
  await dialog.getByRole('button', { name: 'Publicar revisión' }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]?.body.valor).toBe('100.1234');
  await page.screenshot({
    path: info.outputPath('seguros-oficiales.png'),
    fullPage: true,
  });
  if (info.project.name === 'mobile')
    await page.locator('.sidebar-toggle').click();
  await page
    .getByRole('link', { name: 'Seguros Particulares SCVO / ART' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Seguros Particulares SCVO / ART' }),
  ).toBeFocused();
  await page.locator('.empresa-global-trigger').click();
  await page.getByRole('button', { name: /Empresa de prueba Código/ }).click();
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Aseguradora SCVO').fill('Aseguradora test');
  await dialog.getByLabel('Póliza SCVO').fill('P-TEST');
  await dialog.getByLabel('Aseguradora ART').fill('ART test');
  await dialog.getByLabel('Contrato ART').fill('C-TEST');
  await dialog.getByLabel('Alícuota ART (%)').fill('2.5');
  await dialog.getByLabel('Fijo ART por trabajador ($, sin FFEP)').fill('0');
  await dialog.getByLabel('Período desde').fill('2026-11');
  await dialog
    .getByLabel('Motivo de la publicación')
    .fill('Contrato de prueba');
  await dialog.getByRole('button', { name: 'Publicar revisión' }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[1]?.body.alicuotaArt).toBe('2.5');
  expect(writes[1]?.body.fijoArt).toBe('0');
  await page.screenshot({
    path: info.outputPath('seguros-empresa.png'),
    fullPage: true,
  });
  if (info.project.name === 'mobile')
    await page.locator('.sidebar-toggle').click();
  await page
    .locator('#app-sidebar')
    .getByRole('link', { name: 'Legajos', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cobertura SCVO' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Aplicabilidad SCVO').selectOption('noCorresponde');
  await dialog.getByLabel('Período desde').fill('2026-11');
  await dialog
    .getByLabel('Motivo de la publicación')
    .fill('Cobertura por otro empleador, revisada para esta prueba');
  await dialog.getByRole('button', { name: 'Publicar revisión' }).click();
  await expect(dialog.getByRole('status')).toContainText(
    'Nueva revisión publicada',
  );
  expect(writes[2]?.body.estado).toBe('noCorresponde');
  await page.screenshot({
    path: info.outputPath('seguros-legajo.png'),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .include('[role="dialog"], dialog')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  if (info.project.name === 'mobile')
    await page.locator('.sidebar-toggle').click();
  await page
    .locator('#app-sidebar')
    .getByRole('link', { name: 'Valores Generales SCVO / FFEP' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Valores Generales SCVO / FFEP' }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', {
      name: 'Prima mensual SCVO por persona',
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('valores-generales-grilla.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('table')).toHaveCount(0);
  await dialog.getByLabel('Parámetro').selectOption('FFEP_CUOTA');
  await dialog.getByLabel('Régimen').selectOption('casasParticulares');
  await dialog.getByLabel('Importe oficial ($)').fill('250.1234');
  await dialog.getByLabel('Fuente normativa').fill('Fuente ficticia de prueba');
  await dialog.getByLabel('Período desde').fill('2026-11');
  await dialog
    .getByLabel('Motivo de la publicación')
    .fill('Alta desde pantalla independiente');
  await page.screenshot({
    path: info.outputPath('valores-generales-alta.png'),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .include('[role="dialog"], dialog')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog.getByRole('button', { name: 'Publicar revisión' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('cell', { name: 'Cuota FFEP por persona', exact: true }),
  ).toBeVisible();
  expect(writes[3]?.body.valor).toBe('250.1234');
  await page
    .getByRole('button', { name: 'Copiar', exact: true })
    .last()
    .click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Importe oficial ($)')).toHaveValue(
    '250.1234',
  );
  await expect(dialog.getByLabel('Motivo de la publicación')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Publicar revisión' }).click();
  await expect(dialog.getByText('Indicá el motivo.')).toBeVisible();
  expect(writes).toHaveLength(4);
  await page.route('**/api/seguros/parametros', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: oficiales });
    return route.fulfill({
      status: 409,
      json: {
        detail:
          'La configuración cambió. Actualice el historial antes de publicar.',
      },
    });
  });
  await dialog
    .getByLabel('Motivo de la publicación')
    .fill('Intento en conflicto');
  await dialog.getByRole('button', { name: 'Publicar revisión' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'La configuración cambió.',
  );
  await expect(dialog.getByLabel('Importe oficial ($)')).toHaveValue(
    '250.1234',
  );
  await dialog.getByRole('button', { name: 'Actualizar historial' }).click();
  await expect(dialog.getByLabel('Motivo de la publicación')).toHaveValue(
    'Intento en conflicto',
  );
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(writes).toHaveLength(4);
  await page.route('**/api/users/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 7, userName: 'ana' },
        actor: {
          userId: 7,
          tenantId: 2,
          applicationId: 42,
          isSuperAdmin: false,
          permissions: ['empresas:read'],
        },
      },
    }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      json: {
        accessToken: 'test-only-renewed-access',
        refreshToken: 'test-only-renewed-refresh',
        accessTokenRemainingMilliseconds: 3_600_000,
        accessTokenExpiry: new Date(Date.now() + 3_600_000).toISOString(),
        refreshTokenExpiry: new Date(Date.now() + 86_400_000).toISOString(),
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole('cell', { name: 'Cuota FFEP por persona', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Nuevo', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Copiar', exact: true }),
  ).toHaveCount(0);
});
