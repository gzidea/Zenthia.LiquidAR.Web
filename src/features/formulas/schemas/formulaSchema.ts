import { z } from 'zod';
import type { FormulaData } from '../types/formula';
const integer = z
  .string()
  .refine(
    (v) =>
      v === '' ||
      (/^-?\d+$/.test(v) &&
        Number(v) >= -2147483648 &&
        Number(v) <= 2147483647),
    'Ingresá un entero válido.',
  );
export const formulaSchema = z.object({
  codigo: integer,
  codigoAfip: integer,
  conceptoId: integer,
  convenioId: integer,
  unidadId: integer,
  orden: integer,
  descripcion: z.string().max(255, 'Admite hasta 255 caracteres.'),
  formulaCantidad: z.string(),
  formulaBase: z.string(),
  formulaImporte: z.string(),
  visible: z.boolean(),
  activo: z.boolean(),
  afectaMejorSueldo: z.boolean(),
  afectaImpuestoGanancia: z.boolean(),
  incluirDescripcionConcepto: z.boolean(),
  sumaAlBasico: z.boolean(),
  auxiliar: z.boolean(),
  informarCantidadLsd: z.boolean(),
  cargarComoNovedad: z.enum(['', 'true', 'false']),
  vigenteDesde: z.string(),
  vigenteHasta: z.string(),
});
export type FormulaFields = z.infer<typeof formulaSchema>;
export const emptyFormula: FormulaData = {
  codigo: null,
  codigoAfip: null,
  conceptoId: null,
  convenioId: null,
  unidadId: null,
  orden: null,
  descripcion: null,
  formulaCantidad: null,
  formulaBase: null,
  formulaImporte: null,
  visible: false,
  activo: false,
  afectaMejorSueldo: false,
  afectaImpuestoGanancia: false,
  incluirDescripcionConcepto: false,
  sumaAlBasico: false,
  auxiliar: false,
  informarCantidadLsd: true,
  cargarComoNovedad: null,
  vigenteDesde: null,
  vigenteHasta: null,
};
export function formulaFields(
  initial: FormulaData = emptyFormula,
): FormulaFields {
  return Object.fromEntries(
    Object.keys(emptyFormula).map((k) => {
      const key = k as keyof FormulaData;
      const v =
        key === 'informarCantidadLsd' ? (initial[key] ?? true) : initial[key];
      return [
        key,
        key === 'cargarComoNovedad'
          ? v === null
            ? ''
            : String(v)
          : key === 'vigenteDesde' || key === 'vigenteHasta'
            ? ((v as string | null)?.slice(0, 10) ?? '')
            : typeof emptyFormula[key] === 'boolean'
              ? v
              : (v?.toString() ?? ''),
      ];
    }),
  ) as FormulaFields;
}
export function toFormula(
  values: FormulaFields,
  original: FormulaData = emptyFormula,
): FormulaData {
  const before = formulaFields(original);
  const numeric = new Set([
    'codigo',
    'codigoAfip',
    'conceptoId',
    'convenioId',
    'unidadId',
    'orden',
  ]);
  return Object.fromEntries(
    Object.keys(emptyFormula).map((k) => {
      const key = k as keyof FormulaFields;
      const v = values[key];
      return [
        key,
        v === before[key]
          ? key === 'informarCantidadLsd'
            ? (original[key] ?? true)
            : original[key]
          : numeric.has(key)
            ? v === ''
              ? null
              : Number(v)
            : key === 'cargarComoNovedad'
              ? v === ''
                ? null
                : v === 'true'
              : v === ''
                ? null
                : key === 'vigenteDesde' || key === 'vigenteHasta'
                  ? `${v}T00:00:00`
                  : v,
      ];
    }),
  ) as unknown as FormulaData;
}
