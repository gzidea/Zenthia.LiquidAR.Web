import { z } from 'zod';
import { ApiError } from '@/services/http/ApiError';
import { parsePdfError } from './reciboErrors';
export class ReciboZipError extends ApiError {
  constructor(
    public readonly recibos: { reciboId: number; mensaje: string }[],
  ) {
    super(
      'validation',
      'No se descargó el lote. Revisá los recibos indicados y volvé a intentar.',
      422,
    );
  }
}
export function parseZipError(error: ApiError, body: unknown): ApiError {
  const parsed = z
    .object({
      errores: z
        .array(
          z.object({
            reciboId: z.number().int().positive(),
            mensaje: z.string(),
            status: z.number().int(),
          }),
        )
        .min(1)
        .max(100),
    })
    .safeParse(body);
  if (error.status === 422 && parsed.success)
    return new ReciboZipError(
      parsed.data.errores.map((e) => ({
        reciboId: e.reciboId,
        mensaje:
          e.status === 404
            ? 'Recibo no encontrado.'
            : parsePdfError(
                new ApiError(
                  'validation',
                  'No se pudo emitir el PDF. Revisá el recibo.',
                  e.status,
                ),
                { detail: e.mensaje },
              ).message,
      })),
    );
  if (error.status === 413)
    return new ApiError(
      'validation',
      'El lote supera 64 MB. Seleccioná menos recibos.',
      413,
    );
  if (error.status === 400)
    return new ApiError(
      'validation',
      'Seleccioná entre 1 y 100 recibos sin repetir.',
      400,
    );
  return error;
}
