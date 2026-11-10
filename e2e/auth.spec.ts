import { test, expect, type Page, type TestInfo } from '@playwright/test';
// This scenario captures and audits several full pages in each viewport.
test.setTimeout(60000);
import AxeBuilder from '@axe-core/playwright';
import { loginResponse, changedUser } from '../src/test/fixtures';

async function checkScreen(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

test('login, primer ingreso, cambio y logout con contrato simulado; responsive y accesibilidad', async ({
  page,
}, info) => {
  const calls: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push(`${request.method()} ${path}`);
    if (path === '/api/auth/login') {
      expect(request.postDataJSON()).toEqual({
        userName: 'ana',
        password: 'Temporal123',
        applicationId: 42,
      });
      await route.fulfill({
        json: loginResponse({ firstLogin: true, requiresPasswordChange: true }),
      });
    } else if (path === '/api/users/me') {
      await route.fulfill({
        json: {
          actor: {
            userId: 7,
            tenantId: 2,
            applicationId: 42,
            isSuperAdmin: false,
            permissions: [],
          },
        },
      });
    } else if (path === '/api/users/') {
      expect(request.method()).toBe('PUT');
      expect(request.postDataJSON()).toEqual({
        currentPassword: 'Temporal123',
        newPassword: 'Nueva123',
        confirmPassword: 'Nueva123',
      });
      await route.fulfill({ json: changedUser });
    } else if (path === '/api/auth/revoke') {
      await route.fulfill({
        json: { message: 'Tokens revocados correctamente.' },
      });
    } else {
      await route.abort();
      throw new Error(`Endpoint inesperado: ${path}`);
    }
  });
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
  await checkScreen(page, info, 'login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Te damos la bienvenida' }),
  ).toBeVisible();
  await checkScreen(page, info, 'first-login');
  await page.getByRole('link', { name: 'Elegir mi contraseña →' }).click();
  await checkScreen(page, info, 'change-password');
  await page.getByLabel('Contraseña temporal').fill('Temporal123');
  await page.getByLabel('Contraseña nueva').fill('Nueva123');
  await page.getByLabel('Confirmar contraseña').fill('Nueva123');
  await page.getByRole('button', { name: 'Guardar y entrar →' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, ana.' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    'Tu contraseña se actualizó correctamente.',
  );
  await checkScreen(page, info, 'app');
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Menú' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeVisible();
    await checkScreen(page, info, 'app-menu');
    await page.getByRole('link', { name: 'Inicio', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Menú' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  }
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 1]);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toHaveText(
    'Cerraste sesión correctamente.',
  );
  expect(calls).toContain('GET /api/users/me');
  expect(calls.filter((call) => call !== 'GET /api/users/me')).toEqual([
    'POST /api/auth/login',
    'PUT /api/users/',
    'POST /api/auth/revoke',
  ]);
  expect(errors).toEqual([]);
});

test('recargar restaura la sesión mediante refresh sin exponer cookies HttpOnly', async ({
  page,
  context,
}) => {
  const calls: string[] = [];
  await page.route('**/api/**', async (route) => {
    calls.push(new URL(route.request().url()).pathname);
    if (calls.at(-1) === '/api/auth/refresh') {
      const response = loginResponse();
      await route.fulfill({
        json: {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          accessTokenExpiry: response.expiresAt,
          refreshTokenExpiry: response.expiresAt,
        },
      });
      return;
    }
    if (calls.at(-1) === '/api/users/me') {
      await route.fulfill({
        json: {
          user: { id: 7, userName: 'ana' },
          actor: {
            userId: 7,
            tenantId: 2,
            applicationId: 42,
            isSuperAdmin: false,
            permissions: [],
          },
        },
      });
      return;
    }
    if (calls.at(-1) !== '/api/auth/login') {
      await route.abort();
      return;
    }
    await route.fulfill({ json: loginResponse() });
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o email').fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
  await page.getByRole('button', { name: 'Ingresar →' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, ana.' })).toBeVisible();
  await context.addCookies([
    {
      name: 'access_token',
      value: 'test-only-cookie',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
  ]);
  await expect.poll(() => calls.includes('/api/users/me')).toBe(true);
  const callsBeforeReload = calls.length;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, ana.' })).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
  expect(
    calls
      .slice(callsBeforeReload)
      .filter((path) => path === '/api/auth/refresh'),
  ).toHaveLength(1);
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    'access_token',
  );
});
