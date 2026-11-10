import { z } from 'zod';
import type { Draft, Cambio } from './types';
const number = z
  .string()
  .refine(
    (s) =>
      s.trim() === '' ||
      (/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s) &&
        Number.isFinite(Number(s.replace(',', '.')))),
    'Ingresá un número válido.',
  );
const amount = z
  .string()
  .refine(
    (s) => s === '' || /^[+-]?\d{1,15}(?:[.,]\d{1,4})?$/.test(s),
    'Hasta 15 enteros y 4 decimales.',
  );
export const fieldsSchema = z.object({
  fechaPago: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Indicá la fecha de pago.'),
  diasTrabajados: number,
  horasTrabajadas: number,
  diasVacaciones: number,
});
const detailSchema = z.object({
  cantidad: number,
  importe: amount,
  observaciones: z.string().max(255),
});
export function toCambio(d: Draft): Cambio {
  fieldsSchema.parse(d);
  const n = (s: string) =>
    s.trim() === '' ? null : Number(s.replace(',', '.'));
  return {
    idLegajo: d.original.idLegajo,
    revisionEsperada: d.original.revision,
    fechaPago: d.fechaPago,
    diasTrabajados: n(d.diasTrabajados),
    horasTrabajadas: n(d.horasTrabajadas),
    diasVacaciones: n(d.diasVacaciones),
    quitarFormulas: d.quitarFormulas,
    detalles: Object.entries(d.detalles).map(([id, v]) => {
      detailSchema.parse(v);
      return {
        idFormula: Number(id),
        cantidad: n(v.cantidad),
        importe: v.importe === '' ? null : v.importe.replace(',', '.'),
        observaciones: v.observaciones || null,
      };
    }),
  };
}
