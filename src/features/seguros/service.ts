import { z } from 'zod';
import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

export type SegurosKind = 'oficial' | 'empresa' | 'legajo';
export interface Version {
  id: number;
  revision: number;
  desde: string;
  hasta: string | null;
  motivo: string;
  creadoEn: string;
  creadoPor: number;
}
export interface Row {
  version: Version;
  codigo?: string;
  regimen?: string;
  valor?: string;
  fuente?: string;
  aseguradoraScvo?: string;
  polizaScvo?: string;
  aseguradoraArt?: string;
  contratoArt?: string;
  alicuotaArt?: string | null;
  fijoArt?: string | null;
  estado?: string;
}
const version = z.object({
  id: z.number().int().positive(),
  revision: z.number().int().positive(),
  desde: z.iso.date(),
  hasta: z.iso.date().nullable(),
  motivo: z.string(),
  creadoEn: z.string(),
  creadoPor: z.number().int(),
});
const money = z.string().regex(/^\d+(\.\d{1,4})?$/);
const schemas = {
  oficial: z.object({
    version,
    codigo: z.string(),
    regimen: z.string(),
    valor: money,
    fuente: z.string(),
  }),
  empresa: z.object({
    version,
    regimen: z.string(),
    aseguradoraScvo: z.string(),
    polizaScvo: z.string(),
    aseguradoraArt: z.string(),
    contratoArt: z.string(),
    alicuotaArt: money.nullable(),
    fijoArt: money.nullable(),
  }),
  legajo: z.object({
    version,
    estado: z.enum(['pendiente', 'corresponde', 'noCorresponde']),
  }),
};
const api = new ApiClient(config.liquidarBaseURL, {
  ...sessionHttpHooks,
  getAccessToken,
});
const messages = new Set([
  'Los valores SCVO son comunes a todos los regímenes. Use General; solo FFEP diferencia régimen.',
  'El mantenimiento de valores oficiales requiere SuperAdmin.',
  'Indique código, régimen, importe no negativo (hasta cuatro decimales) y fuente normativa.',
  'Revise régimen, pólizas e importes ART. Los componentes ART requieren aseguradora y contrato.',
  'Indique el estado de cobertura SCVO.',
  'Indique vigencia mensual válida, motivo y revisión esperada.',
  'La configuración cambió. Actualice el historial antes de publicar.',
  'Conflicto al publicar la configuración de seguros.',
  'Empresa no encontrada.',
  'Legajo no encontrado.',
  'Legajo con empresa no encontrado.',
]);
function parseError(error: ApiError, body: unknown) {
  const result = z.object({ detail: z.string() }).safeParse(body);
  return (error.status ?? 500) < 500 &&
    result.success &&
    messages.has(result.data.detail)
    ? new ApiError(
        error.kind,
        result.data.detail,
        error.status,
        error.fieldErrors,
      )
    : error;
}
function path(kind: SegurosKind, id?: number) {
  if (kind === 'oficial') return '/seguros/parametros';
  if (!id || !Number.isSafeInteger(id))
    throw new ApiError('contract', 'Identificador de seguros inválido.');
  return `/${kind === 'empresa' ? 'empresas' : 'legajos'}/${id}/seguros`;
}
export const segurosService = {
  async list(
    kind: SegurosKind,
    id?: number,
    signal?: AbortSignal,
  ): Promise<Row[]> {
    const response = await api.request<unknown>(
      'GET',
      path(kind, id),
      undefined,
      { authenticated: true, signal, parseError },
    );
    const parsed = z.array(schemas[kind]).safeParse(response);
    if (!parsed.success)
      throw new ApiError(
        'contract',
        'No se pudo validar la configuración de seguros.',
      );
    return parsed.data;
  },
  publish(kind: SegurosKind, id: number | undefined, body: unknown) {
    return api.request('POST', path(kind, id), body, {
      authenticated: true,
      parseError,
    });
  },
};
