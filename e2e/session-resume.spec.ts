import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { deferred, loginResponse } from '../src/test/fixtures';

test.setTimeout(60_000);

async function prepare(page: Page, refreshStatus = 200) {
  const baseTime = Date.now();
  const calls: string[] = [];
  let refreshes = 0;
  await page.clock.install({ time: baseTime });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push(`${request.method()} ${path}`);
    if (path === '/api/liquidaciones/capacidades')
      return route.fulfill({
        json: { leer: false, generar: false, corregirNovedades: false },
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
    if (path === '/api/auth/login')
      return route.fulfill({
        json: loginResponse({
          expiresAt: new Date(baseTime + 60_000).toISOString(),
        }),
      });
    if (path === '/api/auth/refresh') {
      refreshes++;
      expect(request.postData()).toBeNull();
      expect(request.headers().authorization).toBeUndefined();
      return route.fulfill({
        status: refreshStatus,
        json:
          refreshStatus === 200
            ? {
                accessToken: 'test-only-renewed-access',
                refreshToken: 'test-only-renewed-refresh',
                accessTokenRemainingMilliseconds: 3_600_000,
                accessTokenExpiry: new Date(baseTime + 3_600_000).toISOString(),
                refreshTokenExpiry: new Date(
                  baseTime + 86_400_000,
                ).toISOString(),
              }
            : {},
      });
    }
    if (path === '/api/users/me')
      return route.fulfill({
        json: {
          user: { id: 7, userName: 'ana' },
          actor: {
            userId: 7,
            applicationId: 42,
            tenantId: 2,
            isSuperAdmin: false,
            permissions: ['obrassociales:read', 'obrassociales:write'],
          },
        },
      });
    if (path === '/api/obras-sociales/provincias')
      return route.fulfill({ json: [] });
    if (path === '/api/obras-sociales' && request.method() === 'GET') {
      expect(request.headers().authorization).toBe(
        refreshes
          ? 'Bearer test-only-renewed-access'
          : 'Bearer test-only-access',
      );
      return route.fulfill({
        json: { items: [], total: 0, page: 1, pageSize: 25 },
      });
    }
    throw new Error('Solicitud inesperada: ' + request.method() + ' ' + path);
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, ana.' })).toBeVisible();
  return { calls, baseTime };
}

test('aviso sin actividad, accesible y responsive; retoma y conserva el formulario abierto', async ({
  page,
}, info) => {
  const { calls } = await prepare(page);
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('link', { name: 'Obras Sociales', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Borrador conservado');
  await page.clock.fastForward(60_000);
  const dialog = page.getByRole('dialog', {
    name: 'Tu sesión está por cerrarse',
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('timer')).toContainText('segundos');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  expect(calls.filter((call) => call.includes('/auth/refresh'))).toHaveLength(
    0,
  );
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Extender la sesión' }),
  ).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.left >= 0 &&
        bounds.right <= innerWidth &&
        bounds.top >= 0 &&
        bounds.bottom <= innerHeight &&
        element.scrollWidth <= element.clientWidth
      );
    }),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('session-expired.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Extender la sesión' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'Nueva obra social' }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Borrador conservado',
  );
  expect(
    calls.filter((call) => call === 'POST /api/auth/refresh'),
  ).toHaveLength(1);
  expect(
    calls.filter((call) =>
      /^(POST|PUT|DELETE) \/api\/obras-sociales/.test(call),
    ),
  ).toHaveLength(0);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const readsBeforeRefresh = calls.filter(
    (call) => call === 'GET /api/obras-sociales',
  ).length;
  await page.getByRole('button', { name: 'Refrescar', exact: true }).click();
  await expect
    .poll(
      () => calls.filter((call) => call === 'GET /api/obras-sociales').length,
    )
    .toBeGreaterThan(readsBeforeRefresh);
});

test('al volver de suspensión usa el plazo real y cierra a los 30 segundos', async ({
  page,
}) => {
  const { baseTime, calls } = await prepare(page);
  await page.clock.setSystemTime(baseTime + 70_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByRole('dialog', { name: 'Tu sesión está por cerrarse' }),
  ).toBeVisible();
  await expect(page.getByRole('timer')).toContainText('20');
  await page.clock.setSystemTime(baseTime + 90_000);
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toHaveText(
    'Tu sesión venció. Iniciá sesión nuevamente.',
  );
  expect(calls.some((call) => call.includes('/auth/refresh'))).toBe(false);
});

test('refresh rechazado pide login y un fallo temporal permite reintentar sin reiniciar el plazo', async ({
  page,
}) => {
  await prepare(page, 503);
  await page.clock.fastForward(60_000);
  const dialog = page.getByRole('dialog', {
    name: 'Tu sesión está por cerrarse',
  });
  await dialog.getByRole('button', { name: 'Extender la sesión' }).click();
  await expect(dialog.getByRole('alert')).toContainText('no está disponible');
  await expect(
    dialog.getByRole('button', { name: 'Extender la sesión' }),
  ).toBeEnabled();
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await dialog.getByRole('button', { name: 'Extender la sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(dialog).not.toBeVisible();
});

test('coordina el refresh de dos pestañas del mismo origen', async ({
  page,
  context,
}) => {
  await prepare(page);
  const other = await context.newPage();
  const { baseTime } = await prepare(other);
  const firstRefresh = deferred<void>();
  let refreshes = 0;
  for (const current of [page, other]) {
    await current.route('**/api/auth/refresh', async (route) => {
      refreshes++;
      if (refreshes === 1) await firstRefresh.promise;
      await route.fulfill({
        json: {
          accessToken: 'test-only-renewed-access',
          refreshToken: 'test-only-renewed-refresh',
          accessTokenRemainingMilliseconds: 3_600_000,
          accessTokenExpiry: new Date(Date.now() + 3_600_000).toISOString(),
          refreshTokenExpiry: new Date(Date.now() + 86_400_000).toISOString(),
        },
      });
    });
  }
  // Playwright's clock is shared by pages in this browser context.
  await page.clock.pauseAt(baseTime + 65_000);
  await page.bringToFront();
  await page.getByRole('button', { name: 'Extender la sesión' }).click();
  await expect.poll(() => refreshes).toBe(1);
  await other.bringToFront();
  await other.getByRole('button', { name: 'Extender la sesión' }).click();
  await expect
    .poll(() =>
      other.evaluate(
        async () =>
          (await navigator.locks.query()).pending?.filter(
            (lock) => lock.name === 'liquidar-security-session',
          ).length,
      ),
    )
    .toBe(1);
  expect(refreshes).toBe(1);
  firstRefresh.resolve();
  await expect(
    page.getByRole('dialog', { name: 'Tu sesión está por cerrarse' }),
  ).not.toBeVisible();
  await expect(
    other.getByRole('dialog', { name: 'Tu sesión está por cerrarse' }),
  ).not.toBeVisible();
  expect(refreshes).toBe(2);
  await other.close();
});
