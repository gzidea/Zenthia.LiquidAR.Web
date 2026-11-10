import { test, expect } from '@playwright/test';

test('demo pública: recálculo, cambio de convenio y diseño adaptable', async ({
  page,
}, testInfo) => {
  const securityCalls: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/auth/'))
      securityCalls.push(r.url());
  });
  await page.route('**/api/demo/recibo', (r) =>
    r.fulfill({
      json: {
        periodoInicial: '2026-10',
        tipoLiquidacion: 'Mensual',
        fechaReferencia: '2026-10-14',
        jornadaHoras: 1,
        nombre: 'Pérez Martínez Ana Sofía',
        fechaIngreso: '2016-01-02',
        convenios: [
          { id: 1, nombre: 'Convenio de prueba A' },
          { id: 2, nombre: 'Convenio de prueba B' },
        ],
        seguros: {
          regimen: 'general',
        },
      },
    }),
  );
  await page.route('**/api/demo/recibo/categorias/*', (r) => {
    const id = Number(r.request().url().split('/').at(-1));
    return r.fulfill({ json: [{ id, nombre: 'Administrativo ' + id }] });
  });
  await page.route('**/api/demo/recibo/calcular', (r) => {
    const request = r.request().postDataJSON() as {
      nombre: string;
      fechaIngreso: string;
      convenioId: number;
      categoriaId: number;
      periodo: string;
    };
    return r.fulfill({
      json: {
        calculado: true,
        nombre: request.nombre,
        fechaIngreso: request.fechaIngreso,
        convenio: 'Convenio ' + request.convenioId,
        categoria: 'Administrativo ' + request.categoriaId,
        periodo: request.periodo.slice(5, 7) + request.periodo.slice(0, 4),
        fechaReferencia: '2026-10-14',
        antiguedad: 'Años: 10 Meses: 9',
        importeCategoria: 1230000,
        detalles: [
          {
            formulaId: request.convenioId * 10,
            descripcion: 'Básico de convenio ' + request.convenioId,
            cantidad: 30,
            base: 41000,
            importe: 1230000,
            remunerativo: 1230000,
            noRemunerativo: 0,
            descuento: 0,
            contribuciones: 0,
          },
          {
            formulaId: 3,
            descripcion: 'Antigüedad',
            cantidad: 10,
            base: 12300,
            importe: 123000,
            remunerativo: 123000,
            noRemunerativo: 0,
            descuento: 0,
            contribuciones: 0,
          },
          {
            formulaId: 4,
            descripcion: 'Jubilación SIPA',
            cantidad: 11,
            base: 1353000,
            importe: 148830,
            remunerativo: 0,
            noRemunerativo: 0,
            descuento: 148830,
            contribuciones: 0,
          },
          {
            formulaId: 5,
            descripcion: 'Contribución SIPA',
            cantidad: 10.8,
            base: 1353000,
            importe: 146124,
            remunerativo: 0,
            noRemunerativo: 0,
            descuento: 0,
            contribuciones: 146124,
          },
        ],
        totales: {
          remunerativo: 1353000,
          noRemunerativo: 0,
          descuentos: 148830,
          contribuciones: 146124,
          bruto: 1353000,
          neto: 1204170,
          costoTotal: 1499124,
        },
        grupos: [
          {
            idGrupoCosto: 1,
            titulo: 'SIPA',
            empleador: 146124,
            trabajador: 148830,
            total: 294954,
          },
        ],
        diagnosticos: [],
      },
    });
  });
  test.setTimeout(90000);
  await page.goto('/demo/recibo', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByText('Básico de convenio 1', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Tu recibo, en una vista',
  );
  const chart = page.locator('.receipt-chart');
  await expect(chart.getByRole('img')).toHaveAccessibleName(
    'Neto: $ 1.204.170,00, 80%, SIPA: $ 294.954,00, 20%',
  );
  await expect(chart.getByRole('listitem')).toHaveCount(2);
  await expect(chart).toContainText('SIPA · $ 294.954,00 · 20%');
  await chart.screenshot({
    path: `artifacts/browser/grafico-demo-${testInfo.project.name}.png`,
  });
  await page.screenshot({
    path: `artifacts/browser/recibo-demo-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel('Convenio', { exact: true }).selectOption('2');
  await expect(page.getByLabel('Categoría', { exact: true })).toHaveValue('0');
  await page.getByLabel('Categoría', { exact: true }).selectOption('2');
  await expect(
    page.getByText('Básico de convenio 2', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Básico de convenio 1', { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Apellido y nombre').fill('Nombre ficticio cambiado');
  await expect(page.getByRole('article')).toContainText(
    'Nombre ficticio cambiado',
  );
  await page.getByLabel('Período de liquidación').fill('2026-09');
  await expect(page.getByRole('article')).toContainText('09 / 2026');
  expect(securityCalls).toEqual([]);
});
