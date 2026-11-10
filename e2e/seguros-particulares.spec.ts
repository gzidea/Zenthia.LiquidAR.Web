import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';

test.setTimeout(60_000);
test('seguros particulares: selección global, cambio, publicación y copia', async ({
  page,
}, info) => {
  const reads: number[] = [];
  const writes: { id: number; body: Record<string, unknown> }[] = [];
  const rows: Record<number, unknown[]> = { 1: [], 2: [] };
  let releasePublish: (() => void) | undefined;
  let blocked = false;
  let failRead = false;
  let conflict = false;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
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
            permissions: ['empresas:read', 'empresas:write'],
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
    if (path === '/api/empresas/selector')
      return route.fulfill({
        json: {
          items: [1, 2].map((id) => ({
            id,
            codigo: id,
            nombre: `Empresa ${id}`,
            claveUnica: '30-00000000-1',
          })),
          page: 1,
          pageSize: 25,
          total: 2,
        },
      });
    const detail = path.match(/^\/api\/empresas\/(\d+)\/completa$/);
    if (detail)
      return route.fulfill({
        json: {
          empresa: { id: Number(detail[1]), nombre: `Empresa ${detail[1]}` },
          contactos: [],
          actividades: [],
          bancos: [],
        },
      });
    const match = path.match(/^\/api\/empresas\/(\d+)\/seguros$/);
    if (match) {
      const id = Number(match[1]);
      if (request.method() === 'GET') {
        reads.push(id);
        return failRead
          ? route.fulfill({ status: 403, json: {} })
          : route.fulfill({ json: rows[id] });
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      if (conflict)
        return route.fulfill({
          status: 409,
          json: {
            detail:
              'La configuración cambió. Actualice el historial antes de publicar.',
          },
        });
      writes.push({ id, body });
      if (blocked)
        await new Promise<void>((resolve) => {
          releasePublish = resolve;
        });
      const { vigencia, ...fields } = body;
      const v = vigencia as { revisionEsperada: number; motivo: string };
      const row = {
        ...fields,
        version: {
          id: (rows[id]?.length ?? 0) + 1,
          revision: v.revisionEsperada + 1,
          desde: '2026-11-01',
          hasta: null,
          motivo: v.motivo,
          creadoEn: '2026-10-28T12:00:00Z',
          creadoPor: 7,
        },
      };
      rows[id]?.push(row);
      return route.fulfill({ json: row });
    }
    throw new Error(`Unexpected ${path}`);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Test123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page).toHaveURL(/\/app$/);
  if (info.project.name === 'mobile')
    await page.locator('.sidebar-toggle').click();
  await page
    .locator('#app-sidebar')
    .getByRole('button', { name: 'Empresas', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'Seguros Particulares SCVO / ART' })
    .click();
  await expect(
    page.getByText('Primero seleccioná una empresa', { exact: false }),
  ).toBeVisible();
  expect(reads).toEqual([]);
  await expect(
    page.getByRole('button', { name: 'Nuevo', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath('seguros-sin-empresa.png'),
    fullPage: true,
  });
  const selector = page.locator('.empresa-global-trigger');
  async function select(id: number) {
    await selector.click();
    await page
      .getByRole('button', { name: new RegExp(`Empresa ${id} Código`) })
      .click();
  }
  await select(1);
  await expect(
    page.getByText('No hay configuración publicada para esta empresa.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName(/Empresa 1/);
  await dialog.getByLabel('Aseguradora SCVO').fill('SCVO Uno');
  await dialog.getByLabel('Póliza SCVO').fill('POL-UNO');
  await dialog.getByLabel('Aseguradora ART').fill('ART Uno');
  await dialog.getByLabel('Contrato ART').fill('CONT-UNO');
  await dialog.getByLabel('Alícuota ART (%)').fill('101');
  await dialog.getByLabel('Fijo ART por trabajador ($, sin FFEP)').fill('0');
  await dialog.getByLabel('Período desde').fill('2026-11');
  await dialog
    .getByLabel('Motivo de la publicación')
    .fill('Contrato de prueba');
  await dialog.getByRole('button', { name: 'Publicar revisión' }).click();
  await expect(
    dialog.getByText('La alícuota no puede superar 100%.'),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  await dialog.getByLabel('Alícuota ART (%)').fill('2.5');
  await page.screenshot({
    path: info.outputPath('seguros-alta.png'),
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
  blocked = true;
  await dialog.getByRole('button', { name: 'Publicar revisión' }).click();
  await expect.poll(() => writes.length).toBe(1);
  await expect(selector).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeDisabled();
  releasePublish?.();
  await expect(dialog).toHaveCount(0);
  await expect(selector).toBeEnabled();
  expect(writes[0]?.id).toBe(1);
  expect(writes[0]?.body.fijoArt).toBe('0');
  await expect(
    page.getByRole('cell', { name: 'SCVO Uno', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('seguros-grilla.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Copiar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Póliza SCVO')).toHaveValue('POL-UNO');
  await expect(
    dialog.getByLabel('Fijo ART por trabajador ($, sin FFEP)'),
  ).toHaveValue('0');
  await expect(dialog.getByLabel('Motivo de la publicación')).toHaveValue('');
  conflict = true;
  await dialog.getByLabel('Motivo de la publicación').fill('Nueva revisión');
  await dialog.getByRole('button', { name: 'Publicar revisión' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'La configuración cambió.',
  );
  await expect(dialog.getByLabel('Póliza SCVO')).toHaveValue('POL-UNO');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await select(2);
  await expect(
    page.getByText('No hay configuración publicada para esta empresa.'),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'SCVO Uno', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName(/Empresa 2/);
  await expect(dialog.getByLabel('Póliza SCVO')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  failRead = true;
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  failRead = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(
    page.getByText('No hay configuración publicada para esta empresa.'),
  ).toBeVisible();
  await selector.click();
  await page.getByRole('button', { name: 'Sin empresa seleccionada' }).click();
  await expect(
    page.getByText('Primero seleccioná una empresa', { exact: false }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(reads).toContain(2);
});
