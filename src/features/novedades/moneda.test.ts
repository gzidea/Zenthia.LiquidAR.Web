import { describe, expect, it } from 'vitest';
import { formatMoneda } from './moneda';

describe('formatMoneda', () => {
  it.each([
    ['36900000.0000', '$ 36.900.000,000'],
    ['1230000.0000', '$ 1.230.000,000'],
    ['0', '$ 0,000'],
    ['-1234.5678', '$ -1.234,568'],
    ['999999999999999.9999', '$ 1.000.000.000.000.000,000'],
    ['12.3454', '$ 12,345'],
    [null, '—'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatMoneda(value)).toBe(expected);
  });
});
