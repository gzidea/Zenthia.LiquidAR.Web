import { ApiClient } from '@/services/http/ApiClient';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

import type {
  Sindicato,
  SindicatoWrite,
  SindicatosPageResult,
  Provincia,
} from '../types/sindicato';
export class SindicatoService {
  constructor(private readonly api: ApiClient) {}
  list(page: number, pageSize: number, signal?: AbortSignal) {
    return this.api.request<SindicatosPageResult>(
      'GET',
      '/sindicatos',
      undefined,
      { authenticated: true, params: { page, pageSize }, signal },
    );
  }
  detail(id: number, signal?: AbortSignal) {
    return this.api.request<Sindicato>('GET', '/sindicatos/' + id, undefined, {
      authenticated: true,
      signal,
    });
  }
  provincias(signal?: AbortSignal) {
    return this.api.request<Provincia[]>('GET', '/provincias', undefined, {
      authenticated: true,
      signal,
    });
  }
  create(data: SindicatoWrite) {
    return this.api.request<Sindicato>('POST', '/sindicatos', data, {
      authenticated: true,
    });
  }
  update(id: number, data: SindicatoWrite) {
    return this.api.request<Sindicato>('PUT', '/sindicatos/' + id, data, {
      authenticated: true,
    });
  }
  delete(id: number) {
    return this.api.request<void>('DELETE', '/sindicatos/' + id, undefined, {
      authenticated: true,
    });
  }
}
// LiquidAR and Security can use independent hosts; authentication is unchanged.
export const sindicatoService = new SindicatoService(
  new ApiClient(config.liquidarBaseURL, {
    ...sessionHttpHooks,
    getAccessToken,
  }),
);
