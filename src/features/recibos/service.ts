import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';
import {
  calculoSchema,
  parseCalculoError,
  parsePdfError,
} from './reciboErrors';
import { parseVista } from './reciboPreview';
import { parseZipError } from './reciboZipErrors';
import type { RecibosFiltro, RecibosPagina } from './listado';
const api = new ApiClient(config.liquidarBaseURL, {
  ...sessionHttpHooks,
  getAccessToken,
});
const opts = { authenticated: true, timeoutMs: 120000 };
export const recibosService = {
  listado: (filter: RecibosFiltro, signal?: AbortSignal) =>
    api.request<RecibosPagina>('GET', '/recibos/listado', undefined, {
      ...opts,
      signal,
      params: { ...filter, descendente: filter.descendente ? 'true' : 'false' },
    }),
  tipos: (signal?: AbortSignal) =>
    api.request<{ id: number; nombre: string }[]>(
      'GET',
      '/recibos/listado/tipos',
      undefined,
      { ...opts, signal },
    ),
  empresas: (
    periodo: string,
    idTipoLiquidacion: number,
    signal?: AbortSignal,
  ) =>
    api.request<{ id: number; nombre: string }[]>(
      'GET',
      '/recibos/listado/empresas',
      undefined,
      { ...opts, signal, params: { periodo, idTipoLiquidacion } },
    ),
  zip: async (reciboIds: number[], signal?: AbortSignal) => {
    let nombre = '';
    const blob = await api.request<Blob>(
      'POST',
      '/recibos/pdf/zip',
      { reciboIds },
      {
        ...opts,
        responseType: 'blob',
        signal,
        parseError: parseZipError,
        onFileName: (value) => {
          nombre = value;
        },
      },
    );
    if (!nombre.endsWith('.zip'))
      throw new ApiError(
        'contract',
        'La API no devolvió el nombre del archivo ZIP.',
      );
    return { blob, nombre };
  },
  pdf: async (id: number) => {
    let nombre = '';
    const blob = await api.request<Blob>(
      'GET',
      `/recibos/${id}/pdf`,
      undefined,
      {
        ...opts,
        responseType: 'blob',
        parseError: parsePdfError,
        onFileName: (value) => {
          nombre = value;
        },
      },
    );
    if (!nombre)
      throw new Error(
        'La API no devolvió el nombre del PDF. Revise Content-Disposition y CORS.',
      );
    return { blob, nombre };
  },
  recalcular: async (id: number) => {
    const body = await api.request<unknown>(
      'POST',
      `/recibos/${id}/recalcular`,
      undefined,
      {
        ...opts,
        parseError: parseCalculoError,
      },
    );
    const result = calculoSchema.safeParse(body);
    if (
      !result.success ||
      result.data.reciboId !== id ||
      !result.data.calculado ||
      !result.data.persistido
    )
      throw new ApiError(
        'contract',
        'No pudimos confirmar el recálculo del recibo. Actualizá los datos antes de reintentar.',
      );
    return result.data;
  },
  previsualizacion: async (id: number, signal?: AbortSignal) => {
    const result = parseVista(
      await api.request<unknown>(
        'GET',
        `/recibos/${id}/previsualizacion`,
        undefined,
        { ...opts, signal },
      ),
    );
    if (result.id !== id)
      throw new ApiError(
        'contract',
        'La previsualización no corresponde al recibo solicitado.',
      );
    return result;
  },
};
