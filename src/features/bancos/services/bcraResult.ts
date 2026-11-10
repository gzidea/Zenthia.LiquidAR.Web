import { z } from 'zod';
import { ApiError } from '@/services/http/ApiError';
import type { BcraImportResult } from '../types/banco';

const knownReasons = new Set([
  'El registro pendiente supera las longitudes permitidas.',
  'El guardado legacy reutilizó otro registro pendiente; este código no fue incorporado.',
  'No se pudo incorporar el banco.',
]);
const resultSchema = z.object({
  incorporados: z.number().int().nonnegative(),
  omitidos: z.number().int().nonnegative(),
  fallidos: z.array(
    z.object({
      codigoEntidad: z.number().int().min(-2147483648).max(2147483647),
      motivo: z
        .string()
        .transform((value) =>
          knownReasons.has(value) ? value : 'No se pudo incorporar el banco.',
        ),
    }),
  ),
});

export class BcraImportError extends ApiError {
  constructor(public readonly result: BcraImportResult) {
    super(
      'conflict',
      'La actualización desde BCRA tuvo errores; los registros incorporados permanecen guardados.',
      409,
    );
  }
}
export function parseBcraResult(value: unknown): BcraImportResult {
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      'contract',
      'No pudimos interpretar el resultado de la actualización. Revisá el listado antes de volver a ejecutarla.',
    );
  return parsed.data;
}
export function parseBcraError(error: ApiError, body: unknown): ApiError {
  if (error.status === 502)
    return new ApiError(
      'server',
      'No se pudo obtener el catálogo de bancos del BCRA.',
      502,
    );
  if (
    error.status === 409 &&
    body &&
    typeof body === 'object' &&
    'resultado' in body
  ) {
    const parsed = resultSchema.safeParse(body.resultado);
    if (parsed.success) return new BcraImportError(parsed.data);
  }
  return error;
}
