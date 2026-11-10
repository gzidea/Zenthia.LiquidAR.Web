import { describe, it, expect } from 'vitest';
import { initialFields, obraSocialSchema, toWrite } from './obraSocialSchema';
describe('contrato ObraSocial', () => {
  it('excluye localidad e identidad y conserva espacios y cadenas vacías del registro', () => {
    const original = {
      ...toWrite(initialFields()),
      codigo: '',
      nombre: '  Obra  ',
      id: 9,
      localidad: 'Rosario',
      provinciaNombre: null,
    };
    const payload = toWrite(initialFields(original), original);
    expect(payload.codigo).toBe('');
    expect(payload.nombre).toBe('  Obra  ');
    expect(Object.keys(payload)).toHaveLength(12);
    expect(payload).not.toHaveProperty('localidad');
    expect(payload).not.toHaveProperty('id');
  });
  it('no limita los porcentajes a 0–100 y admite importes negativos según contrato', () => {
    const values = {
      ...initialFields(),
      porcientoAporte: '-2',
      porcientoRetencion: '150.25',
      importeAporte: '-999999999999999.9999',
    };
    expect(obraSocialSchema.safeParse(values).success).toBe(true);
    expect(toWrite(values).porcientoRetencion).toBe(150.25);
    expect(toWrite(values).importeAporte).toBe('-999999999999999.9999');
  });
  it('acepta nulos y no inventa campos obligatorios ni formato de email', () => {
    const fields = initialFields();
    expect(obraSocialSchema.safeParse(fields).success).toBe(true);
    expect(toWrite(fields).nombre).toBeNull();
    expect(
      obraSocialSchema.safeParse({ ...fields, email: 'legacy' }).success,
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
      expect(obraSocialSchema.safeParse({ ...fields, ...value }).success).toBe(
        false,
      );
    const importeAporte = '999999999999999.9999';
    expect(toWrite({ ...fields, importeAporte }).importeAporte).toBe(
      importeAporte,
    );
  });
});
