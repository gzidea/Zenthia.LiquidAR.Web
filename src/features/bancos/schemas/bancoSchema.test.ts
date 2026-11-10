import { expect, it } from 'vitest';
import { bancoSchema, initialFields, toWrite } from './bancoSchema';

it('respeta cero, negativos, nulos, espacios y cadenas vacías sin inventar reglas', () => {
  expect(toWrite(initialFields())).toEqual({
    codigoEntidad: 0,
    denominacion: null,
    abreviacion: null,
  });
  const original = {
    codigoEntidad: -1,
    denominacion: '',
    abreviacion: '  XX  ',
  };
  expect(bancoSchema.safeParse(initialFields(original)).success).toBe(true);
  expect(toWrite(initialFields(original), original)).toEqual(original);
});
it.each(['', ' ', 'NaN', '1.5', '2147483648', '-2147483649'])(
  'rechaza un código no representable por Int32: %s',
  (codigoEntidad) => {
    expect(
      bancoSchema.safeParse({ ...initialFields(), codigoEntidad }).success,
    ).toBe(false);
  },
);
it('valida límites de texto y no incluye identidad en las escrituras', () => {
  const fields = {
    codigoEntidad: '2147483647',
    denominacion: 'a'.repeat(255),
    abreviacion: 'x'.repeat(20),
  };
  expect(bancoSchema.safeParse(fields).success).toBe(true);
  expect(
    bancoSchema.safeParse({ ...fields, denominacion: 'x'.repeat(256) }).success,
  ).toBe(false);
  expect(
    bancoSchema.safeParse({ ...fields, abreviacion: 'x'.repeat(21) }).success,
  ).toBe(false);
  expect(Object.keys(toWrite(fields))).toEqual([
    'codigoEntidad',
    'denominacion',
    'abreviacion',
  ]);
});
