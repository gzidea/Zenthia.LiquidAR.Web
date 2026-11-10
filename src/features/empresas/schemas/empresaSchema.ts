import { z } from 'zod';
import type {
  EmpresaCompleta,
  EmpresaCompletaWrite,
  EmpresaWrite,
} from '../types/empresa';
const text = z.string();
const limited = text.max(255, 'Máximo 255 caracteres.');
const integer = text.refine(
  (v) =>
    v === '' ||
    (/^-?\d+$/.test(v) && Number(v) >= -2147483648 && Number(v) <= 2147483647),
  'Ingresá un entero de 32 bits.',
);
const money = text.regex(
  /^-?\d{1,15}(\.\d{1,4})?$/,
  'Usá hasta 15 enteros y 4 decimales, separados por punto.',
);
export const empresaSchema = z.object({
  empresa: z.object({
    codigo: integer,
    nombre: text,
    direccion: text,
    localidad: text,
    idProvincia: integer,
    idTipoClaveUnica: integer,
    claveUnica: limited,
    email: limited,
    telefono: limited,
    idTipoEmpresaAfip: integer,
  }),
  contactos: z
    .array(
      z.object({
        id: z.number().nullable(),
        nombre: text,
        email: limited,
        telefono: limited,
        cargo: limited,
      }),
    )
    .max(1000),
  actividades: z
    .array(
      z.object({
        id: z.number().nullable(),
        idActividad: z.number().nullable(),
        codigoAfip: z.number().nullable(),
        actividad: text,
        valorSeguro: money,
        activo: z.boolean(),
      }),
    )
    .max(1000),
  bancos: z
    .array(
      z.object({
        id: z.number().nullable(),
        idBanco: z.number(),
        banco: text,
        abreviacion: text,
        activo: z.boolean(),
      }),
    )
    .max(1000),
  contactosEliminar: z.array(z.number()),
  actividadesEliminar: z.array(z.number()),
  bancosEliminar: z.array(z.number()),
});
export type EmpresaFields = z.infer<typeof empresaSchema>;
export type EmpresaFieldName = keyof EmpresaFields['empresa'];
export const fieldLabels: Record<EmpresaFieldName, string> = {
  codigo: 'Código',
  nombre: 'Nombre',
  direccion: 'Dirección',
  localidad: 'Localidad',
  idProvincia: 'Provincia',
  idTipoClaveUnica: 'Tipo de clave',
  claveUnica: 'Clave única',
  email: 'Email',
  telefono: 'Teléfono',
  idTipoEmpresaAfip: 'Tipo de empresa AFIP',
};
export function initialFields(value?: EmpresaCompleta): EmpresaFields {
  return {
    empresa: Object.fromEntries(
      Object.keys(fieldLabels).map((key) => [
        key,
        value?.empresa[key as EmpresaFieldName]?.toString() ?? '',
      ]),
    ) as EmpresaFields['empresa'],
    contactos: (value?.contactos ?? []).map((x) => ({
      id: x.id,
      nombre: x.nombre ?? '',
      email: x.email ?? '',
      telefono: x.telefono ?? '',
      cargo: x.cargo ?? '',
    })),
    actividades: (value?.actividades ?? []).map((x) => ({
      id: x.id,
      idActividad: x.idActividad,
      codigoAfip: x.codigoAfip,
      actividad: x.actividad ?? '',
      valorSeguro: x.valorSeguro,
      activo: x.activo,
    })),
    bancos: (value?.bancos ?? []).map((x) => ({
      id: x.id,
      idBanco: x.idBanco,
      banco: x.banco ?? '',
      abreviacion: x.abreviacion ?? '',
      activo: x.activo,
    })),
    contactosEliminar: [],
    actividadesEliminar: [],
    bancosEliminar: [],
  };
}
export function toWrite(
  values: EmpresaFields,
  original?: EmpresaCompleta,
): EmpresaCompletaWrite {
  const number = (key: EmpresaFieldName) =>
    values.empresa[key] === '' ? null : Number(values.empresa[key]);
  const nullable = (value: string, previous?: string | null) =>
    value === '' ? (previous === '' ? '' : null) : value;
  const t = (key: EmpresaFieldName) =>
    nullable(
      values.empresa[key],
      original?.empresa[key] as string | null | undefined,
    );
  const empresa: EmpresaWrite = {
    codigo: number('codigo'),
    nombre: t('nombre'),
    direccion: t('direccion'),
    localidad: t('localidad'),
    codigoPostal: original?.empresa.codigoPostal ?? null,
    idProvincia: number('idProvincia'),
    idTipoClaveUnica: number('idTipoClaveUnica'),
    claveUnica: t('claveUnica'),
    email: t('email'),
    telefono: t('telefono'),
    idTipoEmpresaAfip: number('idTipoEmpresaAfip'),
  };
  const initial = initialFields(original);
  // Send explicit changes; unchanged associations are not rewritten or deleted by omission.
  const changed = <T extends { id: number | null }>(rows: T[], previous: T[]) =>
    rows.filter(
      (row) =>
        row.id === null ||
        JSON.stringify(row) !==
          JSON.stringify(previous.find((x) => x.id === row.id)),
    );
  return {
    empresa,
    contactos: changed(values.contactos, initial.contactos).map((x) => {
      const old = original?.contactos.find((c) => c.id === x.id);
      return {
        id: x.id,
        nombre: nullable(x.nombre, old?.nombre),
        email: nullable(x.email, old?.email),
        telefono: nullable(x.telefono, old?.telefono),
        cargo: nullable(x.cargo, old?.cargo),
      };
    }),
    actividades: changed(values.actividades, initial.actividades).map((x) => ({
      id: x.id,
      idActividad: x.idActividad,
      valorSeguro: x.valorSeguro,
      activo: x.activo,
    })),
    bancos: changed(values.bancos, initial.bancos).map((x) => ({
      id: x.id,
      idBanco: x.idBanco,
      activo: x.activo,
    })),
    contactosEliminar: values.contactosEliminar,
    actividadesEliminar: values.actividadesEliminar,
    bancosEliminar: values.bancosEliminar,
  };
}
