import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

import type { Completo, Write, PageResult, Opcion } from '../types/legajo';
const options = {
  authenticated: true,
  parseError: (error: ApiError, body: unknown) => {
    const title =
      body && typeof body === 'object' && 'title' in body ? body.title : null;
    const messages = [
      'Un concepto no pertenece a este legajo o ya no existe.',
      'No se pudo guardar el legajo completo. No se guardaron cambios parciales.',
      'No se pudo eliminar por un conflicto de datos o relaciones existentes.',
    ];
    return typeof title === 'string' && messages.includes(title)
      ? new ApiError(error.kind, title, error.status, error.fieldErrors)
      : error;
  },
};
const api = new ApiClient(config.liquidarBaseURL, {
  ...sessionHttpHooks,
  getAccessToken,
});
export const legajoService = {
  list: (
    page: number,
    pageSize: number,
    buscar: string,
    empresaId: string,
    signal?: AbortSignal,
  ) =>
    api.request<PageResult>('GET', '/legajos', undefined, {
      ...options,
      signal,
      params: {
        page,
        pageSize,
        ...(buscar ? { buscar } : {}),
        ...(empresaId ? { empresaId } : {}),
      },
    }),
  detail: (id: number, signal?: AbortSignal) =>
    api.request<Completo>('GET', `/legajos/${id}/completo`, undefined, {
      ...options,
      signal,
    }),
  save: (id: number | null, data: Write) =>
    api.request<Completo>(
      id === null ? 'POST' : 'PUT',
      id === null ? '/legajos/completo' : `/legajos/${id}/completo`,
      data,
      options,
    ),
  remove: (id: number) =>
    api.request<void>('DELETE', `/legajos/${id}`, undefined, options),
  catalog: (tipo: string, padreId?: number | null, signal?: AbortSignal) =>
    api.request<Opcion[]>('GET', `/legajos/catalogos/${tipo}`, undefined, {
      ...options,
      signal,
      params: padreId == null ? {} : { padreId },
    }),
};
