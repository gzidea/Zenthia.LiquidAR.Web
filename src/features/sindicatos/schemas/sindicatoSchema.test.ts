import { describe, it, expect } from 'vitest';
import { initialFields, sindicatoSchema, toWrite } from './sindicatoSchema';
describe('contrato Sindicato', () => {
  it('acepta nulos y no inventa campos obligatorios ni formato de email', () => {
    const fields = initialFields();
    expect(sindicatoSchema.safeParse(fields).success).toBe(true);
    expect(toWrite(fields).nombre).toBeNull();
    expect(
      sindicatoSchema.safeParse({ ...fields, email: 'legacy' }).success,
    ).toBe(true);
  });
  it('valida límites, enteros y decimales sin perder precisión', () => {
    const fields = initialFields();
    for (const value of [
      { codigo: 'a'.repeat(256) },
      { codigoPostal: '1.5' },
      { importeAporte: '2.12345' },
      { porcientoAporte: 'NaN' },
    ])
      expect(sindicatoSchema.safeParse({ ...fields, ...value }).success).toBe(
        false,
      );
    const importeAporte = '999999999999999.9999';
    expect(toWrite({ ...fields, importeAporte }).importeAporte).toBe(
      importeAporte,
    );
  });
});
