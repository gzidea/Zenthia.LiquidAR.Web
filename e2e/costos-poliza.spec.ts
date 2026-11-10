import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';
import type {
  CostoPoliza,
  CostoPolizaWrite,
} from '../src/features/empresas/types/costoPoliza';

test('registra un cargo SCVO de empresa, corrige por revisión y conserva el borrador en conflicto', async ({
  page,
}, info) => {
  const rows: CostoPoliza[] = [];
  const writes: CostoPolizaWrite[] = [];
  let conflict = false;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/api/auth/login')
      return route.fulfill({ json: loginResponse() });
    if (url.pathname === '/api/auth/refresh')
      return route.fulfill({ status: 401, json: {} });
    if (url.pathname === '/api/users/me')
      return route.fulfill({
        json: {
          actor: {
            userId: 7,
            tenantId: 1,
            applicationId: 42,
            isSuperAdmin: false,
            permissions: ['empresas:read', 'empresas:write'],
          },
        },
      });
    if (url.pathname === '/api/empresas')
      return route.fulfill({
        json: {
          items: [{ id: 1, nombre: 'Empresa de prueba', codigo: 1 }],
          total: 1,
          page: 1,
          pageSize: 25,
        },
      });
    if (url.pathname === '/api/empresas/1/costos-poliza') {
      if (req.method() === 'GET')
        return route.fulfill({
          json: {
            historial: [...rows].reverse(),
            totalEmpresa: rows.at(-1)?.importe ?? '0',
          },
        });
      const data = req.postDataJSON() as CostoPolizaWrite;
      if (conflict) {
        conflict = false;
        return route.fulfill({
          status: 409,
          json: {
            detail:
              'La revisión del cargo cambió. Actualice el historial antes de publicar.',
          },
        });
      }
      writes.push(data);
      const row: CostoPoliza = {
        ...data,
        id: rows.length + 1,
        periodo: '2026-11-01',
        revision: rows.length + 1,
        creadoEn: '2026-10-20T12:00:00Z',
        creadoPorUserId: 7,
      };
      rows.push(row);
      return route.fulfill({ json: row });
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
  await page.getByRole('link', { name: 'Empresas', exact: true }).click();
  await page
    .getByRole('button', { name: 'Emisión y renovación SCVO', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Emisión y renovación SCVO · Empresa de prueba',
  });
  await dialog.getByLabel('Período del cargo').fill('2026-11');
  await dialog.getByLabel('Póliza SCVO').fill('SCVO-123');
  await dialog
    .getByLabel('Importe del cargo ($)', { exact: true })
    .fill('123.4567');
  await dialog.getByLabel('Motivo y fuente').fill('Factura de emisión');
  await dialog
    .getByRole('button', { name: 'Publicar cargo', exact: true })
    .click();
  await expect(dialog.getByRole('table')).toContainText('123.4567');
  expect(writes[0]).toMatchObject({ periodo: '112026', revisionEsperada: 0 });
  await dialog.getByLabel('Importe del cargo ($)', { exact: true }).fill('120');
  await dialog.getByLabel('Motivo y fuente').fill('Corrección de factura');
  conflict = true;
  await dialog
    .getByRole('button', { name: 'Publicar cargo', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText(
    'La revisión del cargo cambió',
  );
  await expect(dialog.getByLabel('Motivo y fuente')).toHaveValue(
    'Corrección de factura',
  );
  await dialog.getByRole('button', { name: 'Actualizar historial' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Publicar cargo', exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole('button', { name: 'Publicar cargo', exact: true })
    .click();
  await expect(dialog.getByRole('row')).toHaveCount(3);
  expect(writes[1]?.revisionEsperada).toBe(1);
  await page.screenshot({
    path: `artifacts/costos-poliza-${info.project.name}.png`,
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(writes).toHaveLength(2);
});
