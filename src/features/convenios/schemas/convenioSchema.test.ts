import { describe, expect, it } from 'vitest';
import {
  categoriaFields,
  categoriaSchema,
  categoriaWrite,
  convenioSchema,
  convenioFields,
  toWrite,
  month,
} from './convenioSchema';
describe('Convenio and category draft contracts', () => {
  it('preserves decimal precision, zero and null without writing legacy amounts', () => {
    const form = categoriaFields();
    Object.assign(form, {
      inicial: true,
      mes: '2026-01',
      importe: '999999999999999.9999',
      adicional1: '0',
      adicional2: '',
    });
    const category = categoriaWrite(categoriaSchema.parse(form), null);
    expect(category.escalaInicial).toMatchObject({
      periodoDesde: '012026',
      importe: '999999999999999.9999',
      adicional1: '0',
      adicional2: null,
    });
    expect(category).not.toHaveProperty('importe');
    expect(category).not.toHaveProperty('idConvenio');
    expect(categoriaWrite(form, 1).escalaInicial).toBeNull();
  });
  it('does not echo extra response fields into strict write contracts', () => {
    const category = {
      ...categoriaWrite(categoriaFields(), 1),
      convenioNombre: 'read only',
      idConvenio: 7,
    };
    const data = toWrite(convenioFields(), [category], []);
    expect(data.categorias[0]).not.toHaveProperty('convenioNombre');
    expect(data.categorias[0]).not.toHaveProperty('idConvenio');
    expect(data.convenio.codigo).toBeNull();
    expect(data.convenio.nombre).toBeNull();
  });
  it('validates limits without inventing required legacy fields', () => {
    expect(convenioSchema.safeParse(convenioFields()).success).toBe(true);
    expect(
      convenioSchema.safeParse({ ...convenioFields(), codigo: '2147483648' })
        .success,
    ).toBe(false);
    expect(
      categoriaSchema.safeParse({ ...categoriaFields(), inicial: true })
        .success,
    ).toBe(false);
    expect(
      categoriaSchema.safeParse({
        ...categoriaFields(),
        inicial: true,
        mes: '2026-01',
        importe: '1.00001',
      }).success,
    ).toBe(false);
    expect(month.safeParse('0000-01').success).toBe(false);
  });
  it('allows discarding an invalid optional initial scale without hidden errors', () => {
    const values = categoriaSchema.parse({
      ...categoriaFields(),
      inicial: false,
      mes: '',
      importe: 'invalid',
      motivo: '',
    });
    expect(categoriaWrite(values, null).escalaInicial).toBeNull();
  });
});
