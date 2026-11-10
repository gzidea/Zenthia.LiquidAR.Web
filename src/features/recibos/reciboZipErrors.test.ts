import { expect, it } from 'vitest';
import { ApiError } from '@/services/http/ApiError';
import { parseZipError, ReciboZipError } from './reciboZipErrors';
it('identifica recibos fallidos y filtra mensajes desconocidos', () => {
  const error = parseZipError(new ApiError('validation', 'fallback', 422), {
    errores: [
      {
        reciboId: 4,
        status: 422,
        mensaje:
          'Los totales no coinciden con los detalles almacenados. Recalcule antes de imprimir.',
      },
      { reciboId: 8, status: 500, mensaje: 'private database error' },
      { reciboId: 9, status: 404, mensaje: 'private entity' },
    ],
  });
  expect(error).toBeInstanceOf(ReciboZipError);
  expect((error as ReciboZipError).recibos[0]?.mensaje).toMatch(/Los totales/);
  expect(JSON.stringify(error)).not.toMatch(/private/);
});
it('cuerpos inválidos conservan el error genérico; informa límites', () => {
  const error = new ApiError('validation', 'fallback', 422);
  expect(
    parseZipError(error, {
      errores: [{ reciboId: -1, mensaje: 'x', status: 422 }],
    }),
  ).toBe(error);
  expect(
    parseZipError(new ApiError('server', 'fallback', 413), {}).message,
  ).toMatch(/64 MB/);
});
