import { z } from 'zod';
import type { LegajoData } from '../types/legajo';
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
export const decimal = z
  .string()
  .refine(
    (v) => v === '' || /^-?\d{1,15}(\.\d{1,4})?$/.test(v),
    'Use hasta 15 enteros y 4 decimales, separados por punto.',
  );
export const legajoSchema = z.object({
  legajo: integer,
  idEmpresa: integer,
  nombres: z.string().max(255),
  apellidos: z.string().max(255),
  cuil: z.string().max(255),
  tareas: z.string().max(255),
  fechaIngreso: z.string(),
  fechaIngresoReconocida: z.string(),
  fechaEgreso: z.string(),
  idConvenio: integer,
  condicionliquidacion: integer,
  fueraconvenio: z.boolean(),
  idCategoria: integer,
  idSindicato: integer,
  idObrasocial: integer,
  sueldo: decimal,
  adicional: decimal,
  idJornada: integer,
  idActividad: integer,
  idFormaDePago: integer,
  idEstadoCivil: integer,
  adherentes: integer,
  hijos: integer,
  conyuge: z.enum(['', 'true', 'false']),
  domicilio: z.string().max(100),
  localidad: z.string().max(100),
  idProvincia: integer,
  fechaNacimiento: z.string(),
  cbu: z.string().max(22),
  idCodigoCondicion: integer,
  idCodigoActividad: integer,
  idCodigoModalidadContratacion: integer,
  idCodigoSiniestrado: integer,
  idCodigoLocalidad: integer,
  idSituacionRevista1: integer,
  diaInicioRevista1: integer,
  idSituacionRevista2: integer,
  diaInicioRevista2: integer,
  idSituacionRevista3: integer,
  diaInicioRevista3: integer,
});
export type Fields = z.infer<typeof legajoSchema>;
export const emptyLegajo: LegajoData = {
  legajo: null,
  idEmpresa: null,
  nombres: null,
  apellidos: null,
  cuil: null,
  tareas: null,
  fechaIngreso: null,
  fechaIngresoReconocida: null,
  fechaEgreso: null,
  idConvenio: null,
  condicionliquidacion: null,
  fueraconvenio: false,
  idCategoria: null,
  idSindicato: null,
  idObrasocial: null,
  sueldo: null,
  adicional: null,
  idJornada: null,
  idActividad: null,
  idFormaDePago: null,
  idEstadoCivil: null,
  adherentes: null,
  hijos: null,
  conyuge: null,
  domicilio: null,
  localidad: null,
  idProvincia: null,
  fechaNacimiento: null,
  cbu: null,
  idCodigoCondicion: null,
  idCodigoActividad: null,
  idCodigoModalidadContratacion: null,
  idCodigoSiniestrado: null,
  idCodigoLocalidad: null,
  idSituacionRevista1: null,
  diaInicioRevista1: null,
  idSituacionRevista2: null,
  diaInicioRevista2: null,
  idSituacionRevista3: null,
  diaInicioRevista3: null,
};
export const integerFields = new Set([
  'legajo',
  'idEmpresa',
  'idConvenio',
  'condicionliquidacion',
  'idCategoria',
  'idSindicato',
  'idObrasocial',
  'idJornada',
  'idActividad',
  'idFormaDePago',
  'idEstadoCivil',
  'adherentes',
  'hijos',
  'idProvincia',
  'idCodigoCondicion',
  'idCodigoActividad',
  'idCodigoModalidadContratacion',
  'idCodigoSiniestrado',
  'idCodigoLocalidad',
  'idSituacionRevista1',
  'diaInicioRevista1',
  'idSituacionRevista2',
  'diaInicioRevista2',
  'idSituacionRevista3',
  'diaInicioRevista3',
]);
export const dateFields = new Set([
  'fechaIngreso',
  'fechaIngresoReconocida',
  'fechaEgreso',
  'fechaNacimiento',
]);
export function toFields(data: LegajoData = emptyLegajo): Fields {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => key in emptyLegajo)
      .map(([key, value]) => [
        key,
        key === 'fueraconvenio'
          ? value
          : dateFields.has(key)
            ? String(value ?? '').slice(0, 10)
            : String(value ?? ''),
      ]),
  ) as Fields;
}
export function toData(
  values: Fields,
  original: LegajoData = emptyLegajo,
): LegajoData {
  const before = toFields(original);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      value === before[key as keyof Fields]
        ? original[key as keyof LegajoData]
        : key === 'fueraconvenio'
          ? value
          : value === ''
            ? null
            : key === 'conyuge'
              ? value === 'true'
              : integerFields.has(key)
                ? Number(value)
                : value,
    ]),
  ) as unknown as LegajoData;
}
