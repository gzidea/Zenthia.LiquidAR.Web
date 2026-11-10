import { describe, expect, it } from 'vitest';
import { diferencias } from './ConflictReview';

describe('comparación de borrador LSD', () => {
  it('muestra diferencias de cabecera y detalles sin alterar ninguno', () => {
    const local = {
      cabecera: { version: 1 },
      registros03: [{ importe: '100.00' }],
    };
    const remoto = {
      cabecera: { version: 2 },
      registros03: [{ importe: '200.00' }],
    };
    expect(diferencias(local, remoto)).toEqual([
      { campo: 'cabecera.version', local: '1', guardado: '2' },
      { campo: 'registros03.0.importe', local: '100.00', guardado: '200.00' },
    ]);
    expect(local.registros03[0]!.importe).toBe('100.00');
    expect(remoto.registros03[0]!.importe).toBe('200.00');
  });
  it('detecta altas y bajas y no muestra datos iguales', () => {
    expect(diferencias({ items: [1] }, { items: [] })).toEqual([
      { campo: 'items.0', local: '1', guardado: '—' },
    ]);
    expect(diferencias({ a: null }, { a: null })).toEqual([]);
  });
});
