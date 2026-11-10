import { z } from 'zod';
import { ApiError } from '@/services/http/ApiError';
import type { ReciboPreviewData } from '@/components/recibos/types';
import { parsePdfError } from './reciboErrors';
const numeric = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
  .transform(Number)
  .refine(Number.isFinite);
const decimal = numeric.nullable();
const identity = z
  .object({
    empresa: z.string(),
    cuit: z.string(),
    domicilio: z.string(),
    nombre: z.string(),
    cuil: z.string(),
    legajo: z.number().nullable(),
    categoria: z.string(),
    ingreso: z.string().nullable(),
    importeCategoria: decimal,
    convenio: z.string().nullable().optional(),
  })
  .nullable();
export const vistaSchema = z.object({
  persistido: z.boolean(),
  datosCompletos: z.boolean(),
  error: z.string().nullable(),
  camposInconsistentes: z.array(z.string()),
  antiguedad: z.string(),
  datos: z.object({
    detallesPresentacion: z
      .array(
        z.object({
          descripcion: z.string(),
          columna: z.number().nullable(),
          detallesOrigen: z.array(z.number()).nullable().optional(),
          idAgrupacion: z.number().nullable().optional(),
          valores: z.object({
            id: z.number(),
            idConcepto: z.number().nullable(),
            cantidad: decimal,
            base: decimal,
            importe: decimal,
            remunerativo: decimal,
            noRemunerativo: decimal,
            descuento: decimal,
            contribuciones: decimal,
          }),
        }),
      )
      .optional(),
    identidad: identity,
    cabecera: z.object({
      id: z.number(),
      periodo: z.string().nullable(),
      bancoPagoAportes: z.string().nullable(),
      fechaPagoAportes: z.string().nullable(),
      totalRemunerativos: decimal,
      totalNoRemunerativos: decimal,
      totalDescuentos: decimal,
      totalContribuciones: decimal,
      sueldoBruto: decimal,
      netoACobrar: decimal,
      totalCostoLaboral: decimal,
    }),
    detalles: z.array(
      z.object({
        descripcion: z.string(),
        columna: z.number().nullable(),
        valores: z.object({
          id: z.number(),
          idConcepto: z.number().nullable(),
          cantidad: decimal,
          base: decimal,
          importe: decimal,
          remunerativo: decimal,
          noRemunerativo: decimal,
          descuento: decimal,
          contribuciones: decimal,
        }),
      }),
    ),
    grupos: z.array(
      z.object({
        idGrupoCosto: z.number(),
        titulo: z.string(),
        empleador: numeric,
        trabajador: numeric,
        total: numeric,
      }),
    ),
  }),
});
const fields: Record<string, string> = {
  TotalRemunerativos: 'Remunerativos',
  TotalNoRemunerativos: 'No remunerativos',
  TotalDescuentos: 'Descuentos',
  TotalContribuciones: 'Contribuciones',
  SueldoBruto: 'Bruto',
  NetoACobrar: 'Neto',
  TotalCostoLaboral: 'Costo laboral',
};
export function parseVista(body: unknown): {
  result: ReciboPreviewData;
  id: number | null;
  datosCompletos: boolean;
} {
  const parsed = vistaSchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      'contract',
      'No pudimos interpretar la previsualización del recibo. Actualizá los datos.',
    );
  const v = parsed.data,
    c = v.datos.cabecera,
    i = v.datos.identidad;
  const totals =
    c.totalRemunerativos !== null &&
    c.totalNoRemunerativos !== null &&
    c.totalDescuentos !== null &&
    c.totalContribuciones !== null &&
    c.sueldoBruto !== null &&
    c.netoACobrar !== null &&
    c.totalCostoLaboral !== null
      ? {
          remunerativo: c.totalRemunerativos,
          noRemunerativo: c.totalNoRemunerativos,
          descuentos: c.totalDescuentos,
          contribuciones: c.totalContribuciones,
          bruto: c.sueldoBruto,
          neto: c.netoACobrar,
          costoTotal: c.totalCostoLaboral,
        }
      : null;
  const error = v.error
    ? parsePdfError(
        new ApiError(
          'validation',
          'El recibo tiene datos pendientes de revisión.',
          422,
        ),
        { detail: v.error },
      ).message
    : null;
  return {
    id: v.persistido ? c.id : null,
    datosCompletos: v.datosCompletos,
    result: {
      origen: v.persistido ? 'guardado' : 'simulacion',
      empresa: i?.empresa || 'Empresa no disponible',
      domicilio: i?.domicilio ?? null,
      cuit: i?.cuit ?? null,
      cuil: i?.cuil ?? null,
      legajo: i?.legajo ?? null,
      lugarPago: c.bancoPagoAportes,
      fechaPagoAportes: c.fechaPagoAportes?.slice(0, 10) ?? null,
      errorIntegridad: error,
      camposInconsistentes: v.camposInconsistentes.map(
        (f) => fields[f] ?? 'Importe pendiente de revisión',
      ),
      nota: 'Previsualización de los datos del recibo. La emisión del PDF comprueba también su diseño A4.',
      calculado: totals !== null,
      nombre: i?.nombre || 'Empleado no disponible',
      fechaIngreso: i?.ingreso?.slice(0, 10) ?? null,
      convenio: i?.convenio || 'Convenio no disponible',
      categoria: i?.categoria || 'Categoría no disponible',
      periodo: c.periodo ?? '',
      antiguedad: v.antiguedad,
      importeCategoria: i?.importeCategoria ?? null,
      totales: totals,
      detalles: (v.datos.detallesPresentacion ?? v.datos.detalles).map(
        (d, index) => ({
          ...d.valores,
          id: String(index),
          formulaId: d.valores.idConcepto,
          descripcion: d.descripcion || 'Descripción no disponible',
        }),
      ),
      grupos: v.datos.grupos.map((g) => ({
        ...g,
        titulo: g.titulo || 'Grupo sin descripción',
      })),
      grafico: v.datos.grupos
        .filter((g) => g.empleador > 0)
        .map((g) => ({ titulo: g.titulo, importe: g.empleador })),
      diagnosticos: error
        ? [{ codigo: 'Integridad', mensaje: error, concepto: null }]
        : [],
    },
  };
}
