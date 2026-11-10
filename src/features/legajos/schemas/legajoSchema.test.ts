import { describe, it, expect } from 'vitest';
import { emptyLegajo, toFields, toData, legajoSchema } from './legajoSchema';
describe('Legajo draft', () => {
  it('preserves precision, nulls and unchanged timestamps', () => {
    const original = {
      ...emptyLegajo,
      sueldo: '123456789012345.1234',
      conyuge: null,
      fechaIngreso: '2020-01-01T15:30:00',
      cuil: '',
    };
    expect(toData(toFields(original), original)).toEqual(original);
  });
  it('rejects invalid integer and decimal without converting to Number', () => {
    const value = toFields();
    value.sueldo = '1.12345';
    expect(legajoSchema.safeParse(value).success).toBe(false);
    value.sueldo = '123456789012345.1234';
    value.hijos = '1.5';
    expect(legajoSchema.safeParse(value).success).toBe(false);
  });
});
