import { z } from 'zod';
import type { ObraSocialWrite } from '../types/obraSocial';
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
export const obraSocialSchema = z.object({
  codigo: limited,
  nombre: text,
  direccion: text,
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
export type ObraSocialFields = z.infer<typeof obraSocialSchema>;
export const fieldLabels: Record<keyof ObraSocialFields, string> = {
  codigo: 'Código',
  nombre: 'Nombre',
  direccion: 'Dirección',
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
export function initialFields(data?: ObraSocialWrite): ObraSocialFields {
  return Object.fromEntries(
    Object.keys(fieldLabels).map((key) => [
      key,
      data?.[key as keyof ObraSocialWrite]?.toString() ?? '',
    ]),
  ) as ObraSocialFields;
}
export function toWrite(
  values: ObraSocialFields,
  original?: ObraSocialWrite,
): ObraSocialWrite {
  const nullable = (key: keyof ObraSocialFields) =>
    values[key] === '' ? (original?.[key] === '' ? '' : null) : values[key];
  const number = (key: keyof ObraSocialFields) =>
    values[key] === '' ? null : Number(values[key]);
  return {
    codigo: nullable('codigo'),
    nombre: nullable('nombre'),
    direccion: nullable('direccion'),
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
