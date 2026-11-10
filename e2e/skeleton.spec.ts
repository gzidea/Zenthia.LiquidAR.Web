import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('skeleton responsive, accesible y con movimiento reducido', async ({
  page,
}, info) => {
  await page.goto('/examples/skeleton.html');
  const fields = page
    .getByRole('region', { name: 'Formulario de página' })
    .locator('.form-skeleton-fields');
  const columns = await fields.evaluate(
    (element) =>
      getComputedStyle(element).gridTemplateColumns.split(' ').length,
  );
  expect(columns).toBe(
    info.project.name === 'desktop'
      ? 3
      : info.project.name === 'tablet'
        ? 2
        : 1,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.skeleton-block').first()).toHaveCSS(
    'animation-name',
    'none',
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath('skeleton-page.png'),
    fullPage: true,
  });
  for (const size of ['small', 'medium', 'large']) {
    const trigger = page.getByRole('button', { name: `Modal ${size}` });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Formulario de ejemplo' });
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    const dialogColumns = await dialog
      .locator('.form-skeleton-fields')
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length,
      );
    expect(dialogColumns).toBe(
      info.project.name === 'mobile' || size === 'small'
        ? 1
        : size === 'large' && info.project.name === 'desktop'
          ? 3
          : 2,
    );
    expect(await dialog.getByRole('button').count()).toBe(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath(`skeleton-modal-${size}.png`),
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test('DataGrid conserva columnas y reemplaza solo las filas al completar la carga', async ({
  page,
}) => {
  await page.goto('/examples/skeleton.html');
  const grid = page.getByRole('region', { name: 'Ejemplo', exact: true });
  await expect(grid).toHaveAttribute('aria-busy', 'true');
  await expect(grid.locator('tbody tr')).toHaveCount(5);
  const widths = await grid
    .locator('col')
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().width),
    );
  await page.getByRole('button', { name: 'Mostrar datos' }).click();
  await expect(grid).toHaveAttribute('aria-busy', 'false');
  await expect(
    grid.getByText('Registro de ejemplo', { exact: true }),
  ).toBeVisible();
  await expect(grid.locator('.skeleton-grid-row')).toHaveCount(0);
  const loadedWidths = await grid
    .locator('col')
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().width),
    );
  expect(loadedWidths).toEqual(widths);
});
