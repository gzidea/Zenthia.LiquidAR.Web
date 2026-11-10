import { z } from 'zod';
import type { BancoWrite } from '../types/banco';

export const bancoSchema = z.object({
  codigoEntidad: z
    .string()
    .refine(
      (value) =>
        value.trim() !== '' &&
        Number.isInteger(Number(value)) &&
        Number(value) >= -2147483648 &&
        Number(value) <= 2147483647,
      'Ingresá un entero de 32 bits.',
    ),
  denominacion: z.string().max(255, 'Máximo 255 caracteres.'),
  abreviacion: z.string().max(20, 'Máximo 20 caracteres.'),
});
export type BancoFields = z.infer<typeof bancoSchema>;
export const fieldLabels: Record<keyof BancoFields, string> = {
  codigoEntidad: 'Código',
  denominacion: 'Denominación',
  abreviacion: 'Abreviación',
};
export function initialFields(data?: BancoWrite): BancoFields {
  return {
    codigoEntidad: String(data?.codigoEntidad ?? 0),
    denominacion: data?.denominacion ?? '',
    abreviacion: data?.abreviacion ?? '',
  };
}
export function toWrite(
  values: BancoFields,
  original?: BancoWrite,
): BancoWrite {
  const nullable = (key: 'denominacion' | 'abreviacion') =>
    values[key] === '' ? (original?.[key] === '' ? '' : null) : values[key];
  return {
    codigoEntidad: Number(values.codigoEntidad),
    denominacion: nullable('denominacion'),
    abreviacion: nullable('abreviacion'),
  };
}
