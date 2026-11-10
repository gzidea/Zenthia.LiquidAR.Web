import { z } from 'zod';
import type { SindicatoWrite } from '../types/sindicato';
const text = z.string();
const limited = text.max(255, 'Máximo 255 caracteres.');
const numeric = text.refine(
  (v) => v === '' || (v.trim() !== '' && Number.isFinite(Number(v))),
  'Ingresá un número válido.',
);
const integer = numeric.refine(
  (v) =>
    v === '' ||
    (Number.isInteger(Number(v)) &&
      Number(v) >= -2147483648 &&
      Number(v) <= 2147483647),
  'Ingresá un entero de 32 bits.',
);
const money = text.refine(
  (v) => v === '' || /^-?\d{1,15}(\.\d{1,4})?$/.test(v),
  'Usá hasta 15 enteros y 4 decimales, separados por punto.',
);
export const sindicatoSchema = z.object({
  codigo: limited,
  nombre: text,
  direccion: text,
  localidad: text,
  codigoPostal: integer,
  idProvincia: integer,
  email: limited,
  telefono: limited,
  porcientoAporte: numeric,
  porcientoRetencion: numeric,
  importeAporte: money,
  importeRetencion: money,
  baseDeCalculo: limited,
});
export type SindicatoFields = z.infer<typeof sindicatoSchema>;
export const fieldLabels: Record<keyof SindicatoFields, string> = {
  codigo: 'Código',
  nombre: 'Nombre',
  direccion: 'Dirección',
  localidad: 'Localidad',
  codigoPostal: 'Código postal',
  idProvincia: 'Provincia',
  email: 'Email',
  telefono: 'Teléfono',
  porcientoAporte: 'Porcentaje de aporte',
  porcientoRetencion: 'Porcentaje de retención',
  importeAporte: 'Importe de aporte',
  importeRetencion: 'Importe de retención',
  baseDeCalculo: 'Base de cálculo',
};
export function initialFields(data?: SindicatoWrite): SindicatoFields {
  return Object.fromEntries(
    Object.keys(fieldLabels).map((key) => [
      key,
      data?.[key as keyof SindicatoWrite]?.toString() ?? '',
    ]),
  ) as SindicatoFields;
}
export function toWrite(
  values: SindicatoFields,
  original?: SindicatoWrite,
): SindicatoWrite {
  const nullable = (key: keyof SindicatoFields) =>
    values[key] === '' ? (original?.[key] === '' ? '' : null) : values[key];
  const number = (key: keyof SindicatoFields) =>
    values[key] === '' ? null : Number(values[key]);
  return {
    codigo: nullable('codigo'),
    nombre: nullable('nombre'),
    direccion: nullable('direccion'),
    localidad: nullable('localidad'),
    codigoPostal: number('codigoPostal'),
    idProvincia: number('idProvincia'),
    email: nullable('email'),
    telefono: nullable('telefono'),
    porcientoAporte: number('porcientoAporte'),
    porcientoRetencion: number('porcientoRetencion'),
    importeAporte: nullable('importeAporte'),
    importeRetencion: nullable('importeRetencion'),
    baseDeCalculo: nullable('baseDeCalculo'),
  };
}
