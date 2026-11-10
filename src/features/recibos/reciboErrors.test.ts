import { describe, expect, it } from 'vitest';
import { ApiError } from '@/services/http/ApiError';
import {
  parsePdfError,
  permiteRecalcular,
  parseCalculoError,
} from './reciboErrors';

const error = new ApiError('validation', 'Revisá los datos ingresados.', 422);
describe('errores de recibos', () => {
  it('muestra el motivo de totales y habilita la recuperación', () => {
    const detail =
      'Los totales no coinciden con los detalles almacenados. Recalcule antes de imprimir.';
    const result = parsePdfError(error, { detail });
    expect(result.message).toBe(detail);
    expect(permiteRecalcular(result)).toBe(true);
  });
  it('no ofrece recálculo por escala faltante o contenido desconocido', () => {
    const result = parsePdfError(error, {
      detail:
        'El recibo no tiene una escala de categoría vinculada. Adopte la escala y recalcule antes de imprimir.',
    });
    expect(permiteRecalcular(result)).toBe(false);
    expect(parsePdfError(error, { detail: 'Stack trace privado' })).toBe(error);
    expect(
      parsePdfError(new ApiError('server', 'Servicio no disponible.', 500), {
        detail: result.message,
      }).status,
    ).toBe(500);
  });
  it('interpreta diagnósticos del contrato de recálculo sin exponer texto interno', () => {
    const result = parseCalculoError(error, {
      reciboId: 4,
      calculado: false,
      persistido: false,
      diagnosticos: [
        {
          detalleId: 2,
          codigo: 'ReferenciaInvalida',
          mensaje: 'Texto privado',
        },
      ],
    });
    expect(result.message).toContain('Detalle 2');
    expect(result.message).toContain('no está disponible');
    expect(result.message).not.toContain('Texto privado');
    expect(parseCalculoError(error, {})).toBe(error);
  });
});
