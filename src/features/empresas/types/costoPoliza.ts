import { z } from 'zod';

export interface CostoPoliza {
  id: number;
  poliza: string;
  periodo: string;
  tipo: 'emisionSCVO' | 'renovacionSCVO';
  importe: string;
  revision: number;
  motivo: string;
  creadoEn: string;
  creadoPorUserId: number;
  seguroParametroId?: number | null;
  cantidadAsegurados?: number | null;
}
export interface CostosPoliza {
  historial: CostoPoliza[];
  totalEmpresa: string;
}
export const costoPolizaSchema = z.object({
  poliza: z
    .string()
    .trim()
    .min(1, 'Indicá la póliza.')
    .max(100)
    .refine(
      (s) => !/[\x00-\x1f\x7f]/.test(s),
      'La póliza contiene caracteres inválidos.',
    ),
  tipo: z.enum(['emisionSCVO', 'renovacionSCVO']),
  importe: z
    .string()
    .regex(
      /^\d{1,15}(\.\d{1,4})?$/,
      'Indicá un importe no negativo con hasta cuatro decimales.',
    ),
  motivo: z
    .string()
    .trim()
    .min(1, 'Indicá el motivo y la fuente del cargo.')
    .max(1000),
});
export type CostoPolizaFields = z.infer<typeof costoPolizaSchema>;
export interface CostoPolizaWrite extends CostoPolizaFields {
  periodo: string;
  revisionEsperada: number;
}
