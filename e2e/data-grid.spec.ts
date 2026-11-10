import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('grilla: selección, columnas, arrastre, foco, responsive y accesibilidad', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/data-grid.html');
  const grid = page.getByRole('region', {
    name: 'Registros locales',
    exact: true,
  });
  const first = grid.getByRole('row').filter({ hasText: 'Registro 01' });
  const search = grid.getByRole('searchbox');
  const toolbar = grid.locator('.data-grid-toolbar');
  if (info.project.name !== 'mobile') {
    const bounds = await toolbar
      .locator('button,input')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const r = element.getBoundingClientRect();
          return { center: r.y + r.height / 2, right: r.right };
        }),
      );
    expect(
      Math.max(...bounds.map((r) => r.center)) -
        Math.min(...bounds.map((r) => r.center)),
    ).toBeLessThan(2);
    expect(bounds.at(-1)!.right).toBeGreaterThan(bounds[0]!.right);
  }
  await expect(search).toHaveAttribute('placeholder', 'Buscar…');
  await page.getByLabel('Presentación de acciones').selectOption('icon');
  await expect(
    grid.getByRole('button', { name: 'Nuevo', exact: true }),
  ).toHaveText('');
  await expect(
    first.getByRole('button', { name: 'Ver', exact: true }),
  ).toHaveText('');
  await page.getByLabel('Alto de filas').selectOption('64');
  expect(
    await first.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeCloseTo(64, 0);
  const resize = grid.getByRole('separator', { name: 'Ancho de Nombre' });
  await resize.scrollIntoViewIfNeeded();
  const startWidth = Number(await resize.getAttribute('aria-valuenow'));
  const box = (await resize.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(resize).toHaveAttribute(
    'aria-valuenow',
    String(startWidth + 60),
  );
  expect(
    await resize
      .locator('..')
      .evaluate((element) => element.getBoundingClientRect().width),
  ).toBeCloseTo(startWidth + 60, 0);
  await expect(grid.getByRole('columnheader').nth(1)).not.toHaveAttribute(
    'aria-sort',
  );
  await page.getByLabel('Presentación de acciones').selectOption('icon-text');
  await page.getByLabel('Alto de filas').selectOption('48');
  const third = grid.getByRole('row').filter({ hasText: 'Registro 03' });
  await first.getByText('Registro 01').click();
  await third.getByText('Registro 03').click({ modifiers: ['Control'] });
  await expect(grid.getByText('2 seleccionados')).toBeVisible();
  await grid
    .getByRole('row')
    .filter({ hasText: 'Registro 05' })
    .getByText('Registro 05')
    .click({ modifiers: ['Shift'] });
  await expect(grid.getByText('4 seleccionados')).toBeVisible();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
  expect(
    await first.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThan(100);
  await first.focus();
  await first.press('Home');
  await expect(first).toHaveCSS('outline-style', 'solid');
  await expect(first).toHaveCSS('outline-width', '2px');
  await first.press('ArrowDown');
  await expect(
    grid.getByRole('row').filter({ hasText: 'Registro 02' }),
  ).toBeFocused();
  await grid.getByRole('button', { name: 'Columnas', exact: true }).click();
  await grid
    .getByRole('button', { name: 'Mover Importe a la izquierda' })
    .click();
  await expect(grid.getByRole('columnheader').nth(1)).toContainText('Importe');
  await grid
    .getByRole('button', { name: 'Ordenar por Nombre' })
    .locator('..')
    .dragTo(grid.getByRole('columnheader', { name: /Importe/ }));
  await expect(grid.getByRole('columnheader').nth(1)).toContainText('Nombre');
  await grid.getByLabel('Fecha', { exact: true }).check();
  await grid.getByRole('button', { name: 'Filtros', exact: true }).click();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const screenshot = info.outputPath('data-grid.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await info.attach('data-grid', {
    path: screenshot,
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
});
