import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

import type {
  Formula,
  FormulaOrder,
  FormulaCompleta,
  FormulaWrite,
  PageResult,
  CatalogKind,
  Catalogo,
  Filtros,
} from '../types/formula';
const messages = new Set([
  'No se pudo guardar la fórmula por un conflicto de datos. No se guardaron cambios parciales.',
  'Un período no pertenece a esta fórmula o ya no existe.',
  'Un tipo de liquidación no pertenece a esta fórmula o ya no existe.',
  'No se pudo eliminar la fórmula por un conflicto de datos o relaciones existentes.',
]);
const options = {
  authenticated: true,
  parseError: (error: ApiError, body: unknown) => {
    const detail =
      body && typeof body === 'object' && 'detail' in body ? body.detail : null;
    return (error.status ?? 500) < 500 &&
      typeof detail === 'string' &&
      messages.has(detail)
      ? new ApiError(error.kind, detail, error.status, error.fieldErrors)
      : error;
  },
};
const params = (f: Filtros): Record<string, string | number> => ({
  ...(f.buscar ? { buscar: f.buscar } : {}),
  ...(f.convenioId ? { convenioId: f.convenioId } : {}),
  ...(f.activo ? { activo: f.activo } : {}),
});
export class FormulaService {
  constructor(private readonly api: ApiClient) {}
  order(convenioId: number, signal?: AbortSignal) {
    return this.api.request<FormulaOrder>(
      'GET',
      `/formulas/orden/${convenioId}`,
      undefined,
      { ...options, signal },
    );
  }
  saveOrder(convenioId: number, ids: number[], huellaEsperada: string) {
    return this.api.request<FormulaOrder>(
      'PUT',
      `/formulas/orden/${convenioId}`,
      { ids, huellaEsperada },
      options,
    );
  }
  list(page: number, pageSize: number, filtros: Filtros, signal?: AbortSignal) {
    return this.api.request<PageResult<Formula>>(
      'GET',
      '/formulas',
      undefined,
      { ...options, params: { page, pageSize, ...params(filtros) }, signal },
    );
  }
  detail(id: number, signal?: AbortSignal) {
    return this.api.request<FormulaCompleta>(
      'GET',
      `/formulas/${id}/completa`,
      undefined,
      { ...options, signal },
    );
  }
  save(id: number | null, data: FormulaWrite, clone = false) {
    return this.api.request<FormulaCompleta>(
      id === null || clone ? 'POST' : 'PUT',
      id === null
        ? '/formulas/completa'
        : `/formulas/${id}/completa${clone ? '/clonar' : ''}`,
      data,
      options,
    );
  }
  remove(id: number) {
    return this.api.request<void>(
      'DELETE',
      `/formulas/${id}`,
      undefined,
      options,
    );
  }
  duplicate(id: number) {
    return this.api.request<Formula>(
      'POST',
      `/formulas/${id}/duplicados`,
      undefined,
      options,
    );
  }
  exportar(filtros: Filtros) {
    return this.api.request<Blob>('GET', '/formulas/exportar', undefined, {
      ...options,
      params: params(filtros),
      responseType: 'blob',
    });
  }
  async catalog(kind: CatalogKind, signal?: AbortSignal): Promise<Catalogo[]> {
    if (kind !== 'convenios' && kind !== 'conceptos')
      return this.api.request<Catalogo[]>('GET', `/${kind}`, undefined, {
        ...options,
        signal,
      });
    const rows: Catalogo[] = [];
    let page = 1;
    let total: number;
    do {
      const result = await this.api.request<PageResult<Catalogo>>(
        'GET',
        `/${kind}`,
        undefined,
        { ...options, signal, params: { page, pageSize: 100 } },
      );
      rows.push(...result.items);
      total = result.total;
      if (!result.items.length) break;
      page++;
    } while (rows.length < total);
    return rows;
  }
}
export const formulaService = new FormulaService(
  new ApiClient(config.liquidarBaseURL, {
    ...sessionHttpHooks,
    getAccessToken,
  }),
);
