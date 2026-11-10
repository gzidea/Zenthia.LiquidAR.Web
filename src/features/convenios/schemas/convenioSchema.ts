import { z } from 'zod';
import type {
  CategoriaCambio,
  ConvenioCompleto,
  ConvenioWrite,
} from '../types/convenio';
export const integer = z
  .string()
  .refine(
    (v) =>
      v === '' ||
      (/^-?\d+$/.test(v) &&
        Number(v) >= -2147483648 &&
        Number(v) <= 2147483647),
    'Ingresá un entero válido.',
  );
export const money = z
  .string()
  .regex(
    /^$|^-?\d{1,15}(\.\d{1,4})?$/,
    'Usá punto decimal, hasta 15 enteros y 4 decimales.',
  );
export const percentage = z
  .string()
  .regex(
    /^$|^-?\d{1,5}(\.\d{1,4})?$/,
    'Usá punto decimal, hasta 5 enteros y 4 decimales.',
  );
export const month = z
  .string()
  .regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/, 'Seleccioná un período.');
export const periodo = (v: string) => v.slice(5, 7) + v.slice(0, 4);
export const monthInput = (v: string) => v.slice(2) + '-' + v.slice(0, 2);
export const nullable = (v: string) => (v === '' ? null : v);
const numberOrNull = (v: string) => (v === '' ? null : Number(v));
export const convenioSchema = z.object({
  codigo: integer,
  nombre: z.string().max(255),
  descripcion: z.string(),
});
export type ConvenioFields = z.infer<typeof convenioSchema>;
export const convenioFields = (x?: ConvenioCompleto): ConvenioFields => ({
  codigo: x?.convenio.codigo?.toString() ?? '',
  nombre: x?.convenio.nombre ?? '',
  descripcion: x?.convenio.descripcion ?? '',
});
export function toWrite(
  v: ConvenioFields,
  categorias: CategoriaCambio[],
  categoriasEliminar: number[],
  initial?: ConvenioCompleto,
): ConvenioWrite {
  const clean = (c: CategoriaCambio): CategoriaCambio => ({
    id: c.id,
    codigo: c.codigo,
    descripcion: c.descripcion,
    condicionLiquidacion: c.condicionLiquidacion,
    horasNormales: c.horasNormales,
    horasMinimasImponibles: c.horasMinimasImponibles,
    diasMinimosImponibles: c.diasMinimosImponibles,
    escalaInicial: c.escalaInicial ?? null,
  });
  const changes = categorias.flatMap((c) => {
    const previous = initial?.categorias.find(
      (x) => x.categoria.id === c.id,
    )?.categoria;
    const value = clean(c);
    if (previous?.descripcion === '' && value.descripcion === null)
      value.descripcion = '';
    return previous && JSON.stringify(value) === JSON.stringify(clean(previous))
      ? []
      : [value];
  });
  return {
    convenio: {
      codigo: numberOrNull(v.codigo),
      nombre:
        v.nombre === (initial?.convenio.nombre ?? '') && initial
          ? initial.convenio.nombre
          : nullable(v.nombre),
      descripcion:
        v.descripcion === (initial?.convenio.descripcion ?? '') && initial
          ? initial.convenio.descripcion
          : nullable(v.descripcion),
    },
    categorias: changes,
    categoriasEliminar,
  };
}
export const categoriaSchema = z
  .object({
    codigo: integer,
    descripcion: z.string().max(255),
    condicionLiquidacion: integer,
    horasNormales: integer,
    horasMinimasImponibles: integer,
    diasMinimosImponibles: integer,
    inicial: z.boolean(),
    mes: z.string(),
    importe: z.string(),
    adicional1: z.string(),
    adicional2: z.string(),
    motivo: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.inicial) return;
    for (const key of ['importe', 'adicional1', 'adicional2'] as const) {
      const result = money.safeParse(v[key]);
      if (!result.success)
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: result.error.issues[0]?.message ?? 'Importe inválido.',
        });
    }
    if (v.motivo.length > 1000)
      ctx.addIssue({
        code: 'custom',
        path: ['motivo'],
        message: 'El motivo admite hasta 1000 caracteres.',
      });
    if (v.inicial && !month.safeParse(v.mes).success)
      ctx.addIssue({
        code: 'custom',
        path: ['mes'],
        message: 'Seleccioná un período.',
      });
    if (v.inicial && !v.motivo.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['motivo'],
        message: 'Ingresá el motivo.',
      });
  });
export type CategoriaFields = z.infer<typeof categoriaSchema>;
export const categoriaFields = (x?: CategoriaCambio): CategoriaFields => ({
  codigo: x?.codigo?.toString() ?? '',
  descripcion: x?.descripcion ?? '',
  condicionLiquidacion: x?.condicionLiquidacion?.toString() ?? '',
  horasNormales: x?.horasNormales?.toString() ?? '',
  horasMinimasImponibles: x?.horasMinimasImponibles?.toString() ?? '',
  diasMinimosImponibles: x?.diasMinimosImponibles?.toString() ?? '',
  inicial: !!x?.escalaInicial,
  mes: x?.escalaInicial ? monthInput(x.escalaInicial.periodoDesde) : '',
  importe: x?.escalaInicial?.importe ?? '',
  adicional1: x?.escalaInicial?.adicional1 ?? '',
  adicional2: x?.escalaInicial?.adicional2 ?? '',
  motivo: x?.escalaInicial?.motivo ?? 'Escala inicial',
});
export function categoriaWrite(
  v: CategoriaFields,
  id: number | null,
): CategoriaCambio {
  return {
    id,
    codigo: numberOrNull(v.codigo),
    descripcion: nullable(v.descripcion),
    condicionLiquidacion: numberOrNull(v.condicionLiquidacion),
    horasNormales: numberOrNull(v.horasNormales),
    horasMinimasImponibles: numberOrNull(v.horasMinimasImponibles),
    diasMinimosImponibles: numberOrNull(v.diasMinimosImponibles),
    escalaInicial:
      v.inicial && id === null
        ? {
            periodoDesde: periodo(v.mes),
            modo: 'final',
            revisionEsperada: 0,
            motivo: v.motivo,
            importe: nullable(v.importe),
            adicional1: nullable(v.adicional1),
            adicional2: nullable(v.adicional2),
          }
        : null,
  };
}
