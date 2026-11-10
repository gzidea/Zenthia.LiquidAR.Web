import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('modal nativo: foco, Escape, backdrop y bloqueos', async ({ page }) => {
  await page.goto('/examples/modal.html');
  const trigger = page.getByRole('button', {
    name: 'Confirmar operación',
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar operación' });
  await expect(dialog).toBeVisible();
  expect(
    await dialog
      .locator('.modal-header')
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(36);
  const centers = await dialog
    .locator('.modal-title-icon,.modal-title,.modal-close')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return rect.y + rect.height / 2;
      }),
    );
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(1);
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(
    true,
  );
  await expect(dialog.locator('.modal-title')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Cerrar modal' }),
  ).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Cerrar modal' })).toHaveCSS(
    'outline-width',
    '2px',
  );
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Cierre: escape');
  await page.getByLabel('Bloquear Escape').check();
  await page.getByLabel('Bloquear fondo').check();
  await trigger.click();
  await page.keyboard.press('Escape');
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByLabel('Bloquear fondo').uncheck();
  await trigger.click();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Cierre: backdrop');
  await expect(trigger).toBeFocused();
});

test('submit desde footer, loading, error controlado y éxito', async ({
  page,
}) => {
  await page.goto('/examples/modal.html');
  await page
    .getByRole('button', { name: 'Formulario de ejemplo', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Formulario de ejemplo' });
  expect(
    await dialog
      .locator('.modal-header')
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(48);
  const titleLeft = await dialog
    .locator('.modal-title')
    .evaluate((element) => element.getBoundingClientRect().left);
  const subtitleLeft = await dialog
    .locator('.modal-subtitle')
    .evaluate((element) => element.getBoundingClientRect().left);
  expect(subtitleLeft).toBe(titleLeft);
  await expect(dialog).toHaveAccessibleDescription(
    'Completá los datos del ejemplo.',
  );
  await expect(dialog.getByLabel('Etiqueta')).toBeFocused();
  await dialog.getByLabel('Etiqueta').fill('Prueba');
  await dialog.getByLabel('Simular error').check();
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Guardar', exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('No se pudo completar');
  await dialog.getByLabel('Simular error').uncheck();
  await dialog.getByLabel('Etiqueta').press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText(
    'Operación completada: Prueba',
  );
  await expect(
    page.getByRole('button', { name: 'Formulario de ejemplo', exact: true }),
  ).toBeFocused();
});

test('contenido extenso: scroll, footer visible, responsive y axe', async ({
  page,
}, info) => {
  await page.goto('/examples/modal.html');
  await page.getByLabel('Tamaño').selectOption('large');
  await page
    .getByRole('button', { name: 'Contenido extenso', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  const body = dialog.locator('.modal-body');
  expect(
    await body.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    dialog.getByRole('button', { name: 'Cancelar' }),
  ).toBeInViewport();
  await expect(dialog.locator('.modal-header')).toBeInViewport();
  await expect(
    dialog.getByRole('button', { name: 'Acción al final' }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath('modal-long.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Cerrar modal' }).click();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('footer React, modal sin título y modales superpuestos', async ({
  page,
}, info) => {
  await page.goto('/examples/modal.html');
  await page
    .getByRole('button', { name: 'Footer personalizado', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Contenido React arbitrario.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Aceptar' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Acción propia' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Listo' }).click();
  await page.getByRole('button', { name: 'Información', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Información' });
  await expect(dialog.locator('header')).toHaveCount(0);
  await expect(dialog.locator('footer')).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Modal principal', exact: true })
    .click();
  await page.getByRole('button', { name: 'Abrir segundo modal' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Segundo modal' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Abrir segundo modal' }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    'hidden',
  );
  await page.screenshot({ path: info.outputPath('modal.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Modal principal', exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});
