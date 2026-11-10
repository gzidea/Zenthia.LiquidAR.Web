import { describe, expect, it } from 'vitest';
import { compareValues, operatorsFor, processRows } from './model';
import type { DataGridColumn } from './types';

interface Row {
  id: number;
  value: string | number | null;
}
const column: DataGridColumn<Row> = {
  field: 'value',
  header: 'Valor',
  getValue: (row) => row.value,
};

describe('modelo local de DataGrid', () => {
  it('ordena nulos, números, fechas y texto natural sin modificar el origen', () => {
    const rows: Row[] = [
      { id: 1, value: 2 },
      { id: 2, value: null },
      { id: 3, value: 10 },
    ];
    const result = processRows(rows, [column], '', [], {
      field: 'value',
      direction: 'asc',
    });
    expect(result.map((r) => r.id)).toEqual([2, 1, 3]);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(compareValues(null, null)).toBe(0);
    expect(compareValues(1, null)).toBeGreaterThan(0);
    expect(compareValues('Fila 2', 'Fila 10')).toBeLessThan(0);
    expect(
      compareValues(new Date('2026-01-01'), new Date('2026-02-01')),
    ).toBeLessThan(0);
  });
  it('usa extracción/comparación específicas de ordenamiento', () => {
    const rows: Row[] = [
      { id: 1, value: 'ZZ' },
      { id: 2, value: 'A' },
    ];
    expect(
      processRows(
        rows,
        [
          {
            ...column,
            getSortValue: (r) => r.id,
            compare: (a, b) => Number(b) - Number(a),
          },
        ],
        '',
        [],
        { field: 'value', direction: 'asc' },
      ).map((r) => r.id),
    ).toEqual([2, 1]);
    expect(
      processRows(rows, [{ ...column, sortable: false }], '', [], {
        field: 'value',
        direction: 'asc',
      }),
    ).toEqual(rows);
  });
  it('respeta searchable/filterable y filtros vacíos/desconocidos', () => {
    const rows: Row[] = [{ id: 1, value: 'Alfa' }];
    expect(
      processRows(rows, [{ ...column, searchable: false }], 'Alfa', [], null),
    ).toEqual([]);
    expect(
      processRows(
        rows,
        [column],
        '',
        [{ field: 'value', operator: 'eq', value: '' }],
        null,
      ),
    ).toEqual(rows);
    expect(
      processRows(
        rows,
        [column],
        '',
        [{ field: 'missing', operator: 'eq', value: 'a' }],
        null,
      ),
    ).toEqual(rows);
    expect(
      processRows(
        rows,
        [{ ...column, filterable: false }],
        '',
        [{ field: 'value', operator: 'eq', value: 'b' }],
        null,
      ),
    ).toEqual(rows);
    expect(
      processRows(
        rows,
        [column],
        '',
        [{ field: 'value', operator: 'missing', value: 'a' }],
        null,
      ),
    ).toEqual([]);
  });
  it('ofrece operadores de texto insensibles a mayúsculas', () => {
    const operators = operatorsFor(column);
    expect(operators.find((o) => o.value === 'eq')?.test('Alfa', 'ALFA')).toBe(
      true,
    );
    expect(
      operators.find((o) => o.value === 'startsWith')?.test('Alfa', 'al'),
    ).toBe(true);
    expect(
      operators.find((o) => o.value === 'contains')?.test(null, 'al'),
    ).toBe(false);
  });
  it('compara números y fechas con los tres operadores y rechaza nulos', () => {
    for (const type of ['number', 'date'] as const) {
      const operators = operatorsFor({ ...column, type });
      const value = type === 'number' ? 20 : new Date('2026-02-01');
      const same = type === 'number' ? '20' : '2026-02-01';
      const lower = type === 'number' ? '10' : '2026-01-01';
      const upper = type === 'number' ? '30' : '2026-03-01';
      expect(operators.find((o) => o.value === 'eq')?.test(value, same)).toBe(
        true,
      );
      expect(operators.find((o) => o.value === 'gt')?.test(value, lower)).toBe(
        true,
      );
      expect(operators.find((o) => o.value === 'lt')?.test(value, upper)).toBe(
        true,
      );
      for (const operator of operators)
        expect(operator.test(null, same)).toBe(false);
    }
  });
});
