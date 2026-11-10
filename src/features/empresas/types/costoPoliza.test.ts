import { describe, expect, it } from 'vitest';
import { costoPolizaSchema } from './costoPoliza';

describe('Cargos SCVO de empresa', () => {
  const valid = {
    poliza: ' P-123 ',
    tipo: 'emisionSCVO',
    importe: '123.4567',
    motivo: ' Factura verificada ',
  };
  it('conserva precisión y permite anular con importe cero', () => {
    expect(costoPolizaSchema.parse(valid)).toEqual({
      ...valid,
      poliza: 'P-123',
      motivo: 'Factura verificada',
    });
    expect(
      costoPolizaSchema.safeParse({ ...valid, importe: '0' }).success,
    ).toBe(true);
  });
  it('rechaza prima individual, importes negativos, exceso de decimales y falta de fuente', () => {
    for (const input of [
      { ...valid, tipo: 'primaIndividual' },
      { ...valid, importe: '-1' },
      { ...valid, importe: '1.00001' },
      { ...valid, motivo: ' ' },
    ])
      expect(costoPolizaSchema.safeParse(input).success).toBe(false);
  });
});
