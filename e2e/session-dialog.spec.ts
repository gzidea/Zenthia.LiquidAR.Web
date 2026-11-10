import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginResponse } from '../src/test/fixtures';

test.setTimeout(180000);
for (const legacy of [false, true]) {
  test(`aviso de sesión: diseño y cierre inmediato con Security ${legacy ? 'anterior' : 'actual'}`, async ({
    page,
  }, info) => {
    const now = new Date('2026-10-28T15:00:00Z');
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    // A PC with an incorrect calendar must still accept Security's relative lifetime.
    await page.clock.setSystemTime(new Date('2040-01-01T12:00:00Z'));
    const calls: string[] = [];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      calls.push(path);
      if (path === '/api/liquidaciones/capacidades')
        return route.fulfill({
          json: { leer: false, generar: false, corregirNovedades: false },
        });
      if (path === '/api/auth/login') {
        const response = loginResponse({
          expiresAt: new Date(now.getTime() + 120000).toISOString(),
          accessTokenRemainingMilliseconds: 120000,
        });
        const { accessTokenRemainingMilliseconds: _, ...oldResponse } =
          response;
        return route.fulfill({
          json: legacy ? oldResponse : response,
          headers: { Date: now.toUTCString() },
        });
      }
      if (path === '/api/users/me')
        return route.fulfill({
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
      if (path === '/api/configuracion/formulas-empresa')
        return route.fulfill({
          json: {
            enabled: false,
            puedeLeer: false,
            puedeEscribir: false,
            puedeEscribirCentral: false,
          },
        });
      throw new Error(`Petición inesperada: ${path}`);
    });
    await page.goto('/login');
    await page.getByLabel('Usuario o email').fill('ana');
    await page.getByLabel('Contraseña', { exact: true }).fill('Temporal123');
    await page.getByRole('button', { name: 'Ingresar →' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.clock.setSystemTime(new Date('1990-01-01T12:00:00Z'));
    await page.clock.fastForward(legacy ? 119000 : 120000);
    const dialog = page.getByRole('dialog', {
      name: 'Tu sesión está por cerrarse',
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Extender la sesión' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeVisible();
    await expect(page.getByRole('timer')).toContainText('30 segundos');
    // Axe schedules work with browser timers; resume the test clock for its audit.
    await page.clock.resume();
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath('session-dialog.png'),
      fullPage: true,
    });
    await page.clock.fastForward(5000);
    await dialog.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(calls).not.toContain('/api/auth/refresh');
    expect(calls).not.toContain('/api/auth/revoke');
  });
}
