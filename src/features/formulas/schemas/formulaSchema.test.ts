import { describe, expect, it } from 'vitest';
import {
  emptyFormula,
  formulaFields,
  formulaSchema,
  toFormula,
} from './formulaSchema';
describe('contrato de fórmulas', () => {
  it('conserva el comportamiento histórico y permite omitir cantidad solo en TXT', () => {
    const historical = { ...emptyFormula, informarCantidadLsd: undefined };
    expect(formulaFields(historical).informarCantidadLsd).toBe(true);
    const fields = { ...formulaFields(historical), informarCantidadLsd: false };
    const saved = toFormula(fields, historical);
    expect(saved.informarCantidadLsd).toBe(false);
    expect(saved.formulaCantidad).toBe(historical.formulaCantidad);
    expect(formulaFields(saved).informarCantidadLsd).toBe(false);
  });
  it('preserva null, cadenas vacías, espacios, referencias y fechas originales no editadas', () => {
    const original = {
      ...emptyFormula,
      convenioId: 999,
      descripcion: '',
      formulaCantidad: '  DIAS  ',
      vigenteDesde: '2026-01-01T17:30:00',
      cargarComoNovedad: null,
    };
    expect(toFormula(formulaFields(original), original)).toEqual(original);
  });
  it('distingue novedad sin definir, sí y no', () => {
    expect(
      toFormula({ ...formulaFields(), cargarComoNovedad: 'false' })
        .cargarComoNovedad,
    ).toBe(false);
    expect(
      toFormula({ ...formulaFields(), cargarComoNovedad: 'true' })
        .cargarComoNovedad,
    ).toBe(true);
    expect(toFormula(formulaFields()).cargarComoNovedad).toBeNull();
  });
  it('cambia fechas sin convertir zonas horarias y conserva las expresiones literales', () => {
    const data = toFormula({
      ...formulaFields(),
      vigenteDesde: '2026-05-01',
      formulaImporte: '  SI(A > 0, B, C)  ',
    });
    expect(data.vigenteDesde).toBe('2026-05-01T00:00:00');
    expect(data.formulaImporte).toBe('  SI(A > 0, B, C)  ');
  });
  it('valida enteros del contrato sin imponer obligatoriedad', () => {
    expect(formulaSchema.safeParse(formulaFields()).success).toBe(true);
    expect(
      formulaSchema.safeParse({ ...formulaFields(), codigo: '2147483648' })
        .success,
    ).toBe(false);
    expect(
      formulaSchema.safeParse({ ...formulaFields(), codigo: '1.2' }).success,
    ).toBe(false);
  });
});
