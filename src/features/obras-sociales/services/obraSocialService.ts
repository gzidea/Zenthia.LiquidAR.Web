import { ApiClient } from '@/services/http/ApiClient';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

import type {
  ObraSocial,
  ObraSocialWrite,
  ObrasSocialesPageResult,
  Provincia,
} from '../types/obraSocial';
export class ObraSocialService {
  constructor(private readonly api: ApiClient) {}
  list(page: number, pageSize: number, signal?: AbortSignal) {
    return this.api.request<ObrasSocialesPageResult>(
      'GET',
      '/obras-sociales',
      undefined,
      { authenticated: true, params: { page, pageSize }, signal },
    );
  }
  detail(id: number, signal?: AbortSignal) {
    return this.api.request<ObraSocial>(
      'GET',
      '/obras-sociales/' + id,
      undefined,
      {
        authenticated: true,
        signal,
      },
    );
  }
  provincias(signal?: AbortSignal) {
    return this.api.request<Provincia[]>(
      'GET',
      '/obras-sociales/provincias',
      undefined,
      {
        authenticated: true,
        signal,
      },
    );
  }
  create(data: ObraSocialWrite) {
    return this.api.request<ObraSocial>('POST', '/obras-sociales', data, {
      authenticated: true,
    });
  }
  update(id: number, data: ObraSocialWrite) {
    return this.api.request<ObraSocial>('PUT', '/obras-sociales/' + id, data, {
      authenticated: true,
    });
  }
  delete(id: number) {
    return this.api.request<void>(
      'DELETE',
      '/obras-sociales/' + id,
      undefined,
      {
        authenticated: true,
      },
    );
  }
}
// LiquidAR and Security can use independent hosts; authentication is unchanged.
export const obraSocialService = new ObraSocialService(
  new ApiClient(config.liquidarBaseURL, {
    ...sessionHttpHooks,
    getAccessToken,
  }),
);
