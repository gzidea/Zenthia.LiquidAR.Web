import { ApiClient } from '@/services/http/ApiClient';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

import type { Banco, BancoWrite, BancosPageResult } from '../types/banco';
import { parseBcraError, parseBcraResult } from './bcraResult';
export class BancoService {
  constructor(private readonly api: ApiClient) {}
  list(page: number, pageSize: number, signal?: AbortSignal) {
    return this.api.request<BancosPageResult>('GET', '/bancos', undefined, {
      authenticated: true,
      params: { page, pageSize },
      signal,
    });
  }
  detail(id: number, signal?: AbortSignal) {
    return this.api.request<Banco>('GET', '/bancos/' + id, undefined, {
      authenticated: true,
      signal,
    });
  }
  create(data: BancoWrite) {
    return this.api.request<Banco>('POST', '/bancos', data, {
      authenticated: true,
    });
  }
  update(id: number, data: BancoWrite) {
    return this.api.request<Banco>('PUT', '/bancos/' + id, data, {
      authenticated: true,
    });
  }
  async actualizarDesdeBcra() {
    const result = await this.api.request<unknown>(
      'POST',
      '/bancos/actualizar-desde-bcra',
      undefined,
      { authenticated: true, timeoutMs: 120000, parseError: parseBcraError },
    );
    return parseBcraResult(result);
  }
  delete(id: number) {
    return this.api.request<void>('DELETE', '/bancos/' + id, undefined, {
      authenticated: true,
    });
  }
}
// LiquidAR and Security can use independent hosts; authentication is unchanged.
export const bancoService = new BancoService(
  new ApiClient(config.liquidarBaseURL, {
    ...sessionHttpHooks,
    getAccessToken,
  }),
);
