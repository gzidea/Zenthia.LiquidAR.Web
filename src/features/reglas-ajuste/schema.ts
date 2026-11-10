import { z } from 'zod';
import {
  campos,
  month,
  operaciones,
  periodoApi,
  type Condicion,
  type ReglaWrite,
  type Version,
} from './types';
const mes = z
  .string()
  .regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, 'Indicá mes y año.')
  .refine((x) => +x.slice(0, 4) > 0, 'Año inválido.');
const condicion = z
  .object({
    campo: z.string(),
    operador: z.string(),
    valores: z.array(z.number().int().positive().max(2147483647)).optional(),
    valor: z.string().optional(),
    referencia: z.string().optional(),
    desplazamientoMeses: z.number().int().optional(),
    duracionMeses: z.number().int().optional(),
    incluirMesInicial: z.boolean().optional(),
    fechaDesde: z.string().optional(),
    fechaHasta: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (!(c.campo in campos)) return fail('Seleccioná un campo.');
    if (c.campo === 'beneficios.vigentes') {
      if (c.operador !== 'contiene' || !/^[A-Z0-9_]{1,80}$/.test(c.valor ?? ''))
        fail('Código de beneficio: A-Z, 0-9 o _, hasta 80 caracteres.');
    } else if (c.campo === 'legajo.fechaIngreso') {
      const fecha = (s?: string) =>
        !!s &&
        /^\d{4}-\d{2}-\d{2}$/.test(s) &&
        !Number.isNaN(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s;
      if (
        !fecha(c.fechaDesde) ||
        !fecha(c.fechaHasta) ||
        c.fechaDesde! > c.fechaHasta!
      )
        fail('Indicá fechas válidas y ordenadas.');
    } else if (c.campo === 'recibo.periodo') {
      if (
        c.duracionMeses == null ||
        c.duracionMeses < 1 ||
        c.duracionMeses > 1200 ||
        c.desplazamientoMeses == null ||
        Math.abs(c.desplazamientoMeses) > 1200
      )
        fail('Duración: 1..1200 meses. Desplazamiento: -1200..1200.');
    } else {
      const v = c.valores ?? [];
      if (
        !v.length ||
        v.length > 100 ||
        new Set(v).size !== v.length ||
        !['igual', 'en', 'entre'].includes(c.operador) ||
        (c.operador === 'igual' && v.length !== 1) ||
        (c.operador === 'entre' && (v.length !== 2 || v[0]! >= v[1]!))
      )
        fail(
          'Seleccioná valores sin duplicados: uno para igual, hasta 100 para pertenece a, o dos límites ascendentes para entre.',
        );
    }
  });
export const reglaSchema = z
  .object({
    nombre: z.string().trim().min(1, 'Indicá el nombre.').max(200),
    periodoDesde: mes,
    periodoHasta: z.union([mes, z.literal('')]),
    activa: z.boolean(),
    motivo: z
      .string()
      .trim()
      .min(1, 'Indicá el motivo de esta publicación.')
      .max(1000),
    formulas: z
      .array(z.number().int().positive())
      .min(1, 'Agregá al menos una fórmula.')
      .max(500)
      .refine((x) => new Set(x).size === x.length, 'Hay fórmulas repetidas.'),
    condiciones: z.array(condicion).max(20),
    tipo: z.string(),
    valor: z
      .string()
      .regex(
        /^-?\d{1,15}(\.\d{1,4})?$/,
        'Indicá un valor con hasta cuatro decimales (punto decimal).',
      ),
    expresionBase: z.string().max(1024),
    fuenteMensual: z.enum(['', 'SCVO', 'FFEP', 'ART_FIJO']).optional(),
  })
  .superRefine((v, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (v.periodoHasta && v.periodoHasta < v.periodoDesde)
      fail('periodoHasta', 'Hasta no puede ser anterior a Desde.');
    if (!(v.tipo in operaciones)) fail('tipo', 'Seleccioná la operación.');
    const n = Number(v.valor);
    if (v.tipo === 'fijarImporteMensual' && n < 0)
      fail('valor', 'El objetivo mensual debe ser cero o positivo.');
    if (
      ['reduccionPorcentual', 'fijarAlicuota'].includes(v.tipo) &&
      (n < 0 || n > 100)
    )
      fail('valor', 'El porcentaje debe estar entre 0 y 100.');
    if (v.tipo === 'incrementoPorcentual' && (n < 0 || n > 99999.9999))
      fail('valor', 'El incremento debe estar entre 0 y 99999.9999.');
    if (v.tipo === 'fijarAlicuota' && !v.expresionBase.trim())
      fail('expresionBase', 'Indicá la expresión de base.');
  });
export type Fields = z.infer<typeof reglaSchema>;
export function fields(nombre = '', v?: Version | null): Fields {
  return {
    nombre,
    periodoDesde: month(v?.periodoDesde),
    periodoHasta: month(v?.periodoHasta),
    activa: v?.activa ?? true,
    formulas: v?.formulas ?? [],
    condiciones: v?.condiciones.map(clean) ?? [],
    tipo: v?.ajuste.tipo ?? 'reduccionPorcentual',
    valor: v?.ajuste.valor ?? '',
    expresionBase: v?.ajuste.expresionBase ?? '',
    fuenteMensual: (v?.ajuste.fuenteMensual ?? '') as Fields['fuenteMensual'],
    motivo: '',
  };
}
function clean(c: Condicion): Condicion {
  if (c.campo === 'beneficios.vigentes')
    return { campo: c.campo, operador: 'contiene', valor: c.valor };
  if (c.campo === 'legajo.fechaIngreso')
    return {
      campo: c.campo,
      operador: 'entreFechas',
      fechaDesde: c.fechaDesde,
      fechaHasta: c.fechaHasta,
    };
  if (c.campo === 'recibo.periodo')
    return {
      campo: c.campo,
      operador: 'dentroDeVentanaMensual',
      referencia: 'legajo.fechaIngreso',
      desplazamientoMeses: c.desplazamientoMeses,
      duracionMeses: c.duracionMeses,
      incluirMesInicial: c.incluirMesInicial,
    };
  return { campo: c.campo, operador: c.operador, valores: c.valores };
}
export function payload(v: Fields, revision: number): ReglaWrite {
  return {
    nombre: v.nombre.trim(),
    periodoDesde: periodoApi(v.periodoDesde),
    periodoHasta: v.periodoHasta ? periodoApi(v.periodoHasta) : null,
    activa: v.activa,
    formulas: v.formulas,
    condiciones: v.condiciones.map(clean),
    motivo: v.motivo.trim(),
    revisionEsperada: revision,
    ajuste: {
      tipo: v.tipo,
      valor:
        v.tipo === 'fijarImporteMensual' && v.fuenteMensual ? '0' : v.valor,
      ...(v.tipo === 'fijarImporteMensual' && v.fuenteMensual
        ? { fuenteMensual: v.fuenteMensual }
        : {}),
      ...(v.tipo === 'fijarAlicuota'
        ? { expresionBase: v.expresionBase.trim() }
        : {}),
    },
  };
}
