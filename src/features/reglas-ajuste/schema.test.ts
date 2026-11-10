import { describe, expect, it } from 'vitest';
import { fields, payload, reglaSchema } from './schema';
import { nuevaCondicion, type Version } from './types';
describe('Publicación de reglas', () => {
  const valid = () => ({
    ...fields(),
    nombre: 'RIFL',
    periodoDesde: '2026-05',
    formulas: [7],
    valor: '1.3100',
    tipo: 'fijarAlicuota',
    expresionBase: 'C310B',
    motivo: 'Alta verificada',
  });
  it('convierte períodos y conserva precisión decimal y revisión global', () => {
    const data = payload(reglaSchema.parse(valid()), 9);
    expect(data).toMatchObject({
      periodoDesde: '052026',
      periodoHasta: null,
      revisionEsperada: 9,
      ajuste: {
        tipo: 'fijarAlicuota',
        valor: '1.3100',
        expresionBase: 'C310B',
      },
    });
  });
  it('rechaza destinos repetidos, ausencia de base y períodos invertidos', () => {
    expect(
      reglaSchema.safeParse({ ...valid(), formulas: [7, 7] }).success,
    ).toBe(false);
    expect(
      reglaSchema.safeParse({ ...valid(), expresionBase: '' }).success,
    ).toBe(false);
    expect(
      reglaSchema.safeParse({ ...valid(), periodoHasta: '2026-04' }).success,
    ).toBe(false);
  });
  it('permite importe fijo negativo y no envía una base oculta', () => {
    const data = payload(
      reglaSchema.parse({
        ...valid(),
        tipo: 'ajusteImporteFijo',
        valor: '-100.1234',
      }),
      2,
    );
    expect(data.ajuste).toEqual({
      tipo: 'ajusteImporteFijo',
      valor: '-100.1234',
    });
  });
  it('publica objetivos fijos y mensuales sin base oculta, preservando decimales', () => {
    for (const tipo of ['fijarImporte', 'fijarImporteMensual']) {
      const data = payload(
        reglaSchema.parse({ ...valid(), tipo, valor: '123.4567' }),
        2,
      );
      expect(data.ajuste).toEqual({ tipo, valor: '123.4567' });
    }
    expect(
      reglaSchema.safeParse({
        ...valid(),
        tipo: 'fijarImporteMensual',
        valor: '-1',
      }).success,
    ).toBe(false);
    expect(
      reglaSchema.safeParse({
        ...valid(),
        tipo: 'fijarImporteMensual',
        valor: '0',
      }).success,
    ).toBe(true);
  });
  it('construye 710 sin mezclar operandos y rechaza ventanas inválidas', () => {
    const condiciones = [
      {
        campo: 'legajo.modalidadContratacionCodigo',
        operador: 'igual',
        valores: [710],
      },
      { campo: 'beneficios.vigentes', operador: 'contiene', valor: 'RIFL' },
      {
        campo: 'legajo.fechaIngreso',
        operador: 'entreFechas',
        fechaDesde: '2026-05-01',
        fechaHasta: '2027-04-30',
      },
      { ...nuevaCondicion('recibo.periodo'), duracionMeses: 48 },
    ];
    expect(reglaSchema.safeParse({ ...valid(), condiciones }).success).toBe(
      true,
    );
    expect(
      reglaSchema.safeParse({
        ...valid(),
        condiciones: [
          { ...nuevaCondicion('recibo.periodo'), duracionMeses: 0 },
        ],
      }).success,
    ).toBe(false);
  });
  it('normaliza operandos nulos de las respuestas antes de editar', () => {
    const v = {
      periodoDesde: '2026-05-01',
      periodoHasta: null,
      activa: true,
      formulas: [7],
      condiciones: [
        {
          campo: 'beneficios.vigentes',
          operador: 'contiene',
          valor: 'RIFL',
          valores: null,
          fechaDesde: null,
        },
      ],
      ajuste: { tipo: 'reduccionPorcentual', valor: '50', expresionBase: null },
    } as unknown as Version;
    expect(
      reglaSchema.safeParse({ ...fields('Regla', v), motivo: 'Corrección' })
        .success,
    ).toBe(true);
  });
});
