import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

import type {
  Contexto,
  Cambio,
  Empresa,
  Pagina,
  Resultado,
  RevisionImportacion,
} from './types';
const api = new ApiClient(config.liquidarBaseURL, {
  ...sessionHttpHooks,
  getAccessToken,
});
const base = '/novedades/trabajo';
const opts = {
  authenticated: true,
  timeoutMs: 120000,
  parseError: (e: ApiError, b: unknown) => {
    const detail =
      b && typeof b === 'object' && 'detail' in b ? b.detail : null;
    const allowed = [
      'Las columnas no coinciden con la plantilla del contexto. Descárguela nuevamente.',
      'Revise hasta 100 legajos por importación.',
      'Empresa o tipo de liquidación inexistente.',
      'Indique período MMyyyy y tipo de liquidación válidos.',
      'Indique fecha de pago.',
    ];
    return typeof detail === 'string' && allowed.includes(detail)
      ? new ApiError(e.kind, detail, e.status, e.fieldErrors)
      : e;
  },
};
export const novedadesService = {
  catalog: (tipo: string, signal?: AbortSignal) =>
    api.request<{ id: number; nombre: string }[]>(
      'GET',
      `${base}/catalogos/${tipo}`,
      undefined,
      { ...opts, signal },
    ),
  empresas: (
    periodo: string,
    idTipoLiquidacion: number,
    buscar: string,
    signal?: AbortSignal,
  ) =>
    api.request<Empresa[]>('GET', `${base}/empresas`, undefined, {
      ...opts,
      signal,
      params: { periodo, idTipoLiquidacion, buscar },
    }),
  filas: (
    c: Contexto,
    page: number,
    pageSize: number,
    buscar: string,
    idConvenio: string,
    estado: string,
    signal?: AbortSignal,
  ) =>
    api.request<Pagina>('GET', `${base}/legajos`, undefined, {
      ...opts,
      signal,
      params: {
        ...c,
        page,
        pageSize,
        buscar,
        estado,
        ...(idConvenio ? { idConvenio } : {}),
      },
    }),
  quitar: (c: Contexto, id: number, revisionEsperada: number) =>
    api.request<Resultado>('DELETE', `${base}/legajos/${id}`, undefined, {
      ...opts,
      params: { ...c, revisionEsperada },
    }),
  guardar: (contexto: Contexto, cambios: Cambio[]) =>
    api.request<{ items: Resultado[] }>(
      'POST',
      `${base}/guardar`,
      { contexto, cambios },
      opts,
    ),
  plantilla: (c: Contexto, idConvenio: number) =>
    api.request<Blob>('GET', `${base}/plantilla`, undefined, {
      ...opts,
      responseType: 'blob',
      params: { ...c, idConvenio },
    }),
  importar: (c: Contexto, idConvenio: number, fechaPago: string, file: File) =>
    api.request<RevisionImportacion>(
      'POST',
      `${base}/importacion/revisar`,
      file,
      { ...opts, params: { ...c, idConvenio, fechaPago } },
    ),
};
