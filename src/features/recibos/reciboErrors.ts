import { ApiError } from '@/services/http/ApiError';
import { z } from 'zod';

const recalculables = [
  'El recibo no tiene detalles calculados completos o tiene referencias a fórmulas/conceptos inexistentes.',
  'El recibo no tiene todos los totales calculados. Recalcule antes de imprimir.',
  'Los totales no coinciden con los detalles almacenados. Recalcule antes de imprimir.',
  'El resumen de costos falta o no coincide con los detalles. Recalcule el recibo antes de imprimir.',
];
const mensajesPdf = [
  ...recalculables,
  'Faltan datos de la empresa o del legajo para imprimir el recibo.',
  'El recibo no tiene una escala de categoría vinculada. Adopte la escala y recalcule antes de imprimir.',
  'El período almacenado no es válido (MMyyyy).',
  'El contenido no cabe en la estructura A4 del recibo. Revise la extensión de los datos de cabecera y del resumen de costos.',
];
export function permiteRecalcular(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 422 &&
    recalculables.includes(error.message)
  );
}
export function parsePdfError(error: ApiError, body: unknown): ApiError {
  const parsed = z.object({ detail: z.string() }).safeParse(body);
  return error.status === 422 &&
    parsed.success &&
    mensajesPdf.includes(parsed.data.detail)
    ? new ApiError(error.kind, parsed.data.detail, error.status)
    : error;
}
export const calculoSchema = z.object({
  reciboId: z.number().int().positive(),
  calculado: z.boolean(),
  persistido: z.boolean(),
  diagnosticos: z.array(
    z.object({ detalleId: z.number().int().nullable(), codigo: z.string() }),
  ),
});
const diagnosticos: Record<string, string> = {
  EscalaCategoriaInvalida: 'Revisá la escala de categoría vinculada al recibo.',
  ReferenciaInvalida:
    'Una fórmula, concepto o unidad necesaria no está disponible.',
  VariableAmbigua: 'Hay variables faltantes o repetidas en los detalles.',
  UnknownVariable: 'Una fórmula utiliza una variable no disponible.',
};
export function parseCalculoError(error: ApiError, body: unknown): ApiError {
  const parsed = calculoSchema.safeParse(body);
  if (error.status === 422 && parsed.success) {
    const messages = parsed.data.diagnosticos.map(
      (d) =>
        `${d.detalleId ? `Detalle ${d.detalleId}: ` : ''}${diagnosticos[d.codigo] ?? 'No se pudo calcular el recibo. Revisá sus fórmulas y reglas de ajuste.'}`,
    );
    return new ApiError(
      error.kind,
      [...new Set(messages)].join(' ') || 'No se pudo calcular el recibo.',
      422,
    );
  }
  const detail = z.object({ detail: z.string() }).safeParse(body);
  const conflictos = [
    'No se pudo guardar el cálculo por un conflicto de datos.',
    'El recibo cambió durante el cálculo. Vuelva a intentarlo.',
  ];
  return error.status === 409 &&
    detail.success &&
    conflictos.includes(detail.data.detail)
    ? new ApiError(error.kind, detail.data.detail, 409)
    : error;
}
