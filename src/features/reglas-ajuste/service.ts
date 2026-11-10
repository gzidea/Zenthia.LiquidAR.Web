import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

import type {
  Regla,
  Detalle,
  Version,
  ReglaWrite,
  Page,
  Destino,
  Filtros,
  Opcion,
} from './types';
import { periodoApi } from './types';
const api = new ApiClient(config.liquidarBaseURL, {
  ...sessionHttpHooks,
  getAccessToken,
});
const messages = new Set([
  'La revisión cambió. Consulte el historial antes de publicar.',
  'No se pudo publicar por un conflicto de datos.',
  'El nombre identifica la regla y debe conservarse en sus revisiones.',
  'Hay fórmulas seleccionadas inexistentes.',
  'Indique un nombre de hasta 200 caracteres.',
  'Indique un motivo de hasta 1000 caracteres.',
  'Revisión esperada inválida.',
  'Indique períodos MMyyyy válidos y un hasta no anterior al desde.',
  'Seleccione entre 1 y 500 fórmulas individuales, positivas y sin duplicados.',
  'Indique un array de hasta 20 condiciones (vacío significa sin condiciones).',
  'Indique un ajuste con hasta cuatro decimales.',
  'fijarAlicuota requiere valor entre 0 y 100 y expresionBase de hasta 1024 caracteres.',
  'expresionBase sólo se admite con fijarAlicuota.',
  'Indique un período MMyyyy válido.',
  'Filtro inválido: el estado requiere un período y debe ser activa, inactiva, vencida o sinVersion.',
]);
const options = {
  authenticated: true,
  parseError: (error: ApiError, body: unknown) => {
    if (
      [400, 409, 422].includes(error.status ?? 0) &&
      body &&
      typeof body === 'object' &&
      'detail' in body &&
      typeof body.detail === 'string' &&
      messages.has(body.detail)
    )
      return new ApiError(
        error.kind,
        body.detail,
        error.status,
        error.fieldErrors,
      );
    return error;
  },
};
export const reglaService = {
  disponibles: (
    page: number,
    pageSize: number,
    buscar: string,
    convenio: string,
    centralizada: boolean,
    reglaId: number | null,
    signal?: AbortSignal,
  ) =>
    api.request<Page<Destino>>(
      'GET',
      '/reglas-ajuste/formulas-disponibles',
      undefined,
      {
        ...options,
        signal,
        params: {
          page,
          pageSize,
          buscar,
          centralizada: String(centralizada),
          ...(convenio ? { convenioId: convenio } : {}),
          ...(reglaId ? { reglaId } : {}),
        },
      },
    ),
  list: (page: number, pageSize: number, f: Filtros, signal?: AbortSignal) =>
    api.request<Page<Regla>>('GET', '/reglas-ajuste', undefined, {
      ...options,
      signal,
      params: {
        page,
        pageSize,
        ...(f.buscar ? { buscar: f.buscar } : {}),
        ...(f.periodo ? { periodo: periodoApi(f.periodo) } : {}),
        ...(f.estado && f.periodo ? { estado: f.estado } : {}),
      },
    }),
  detail: (id: number, signal?: AbortSignal) =>
    api.request<Detalle>('GET', `/reglas-ajuste/${id}`, undefined, {
      ...options,
      signal,
    }),
  history: (id: number, page: number, signal?: AbortSignal) =>
    api.request<Page<Version>>(
      'GET',
      `/reglas-ajuste/${id}/versiones`,
      undefined,
      { ...options, signal, params: { page, pageSize: 25 } },
    ),
  version: (id: number, version: number, signal?: AbortSignal) =>
    api.request<Version>(
      'GET',
      `/reglas-ajuste/${id}/versiones/${version}`,
      undefined,
      { ...options, signal },
    ),
  save: (id: number | null, data: ReglaWrite) =>
    api.request<Version>(
      'POST',
      id == null ? '/reglas-ajuste' : `/reglas-ajuste/${id}/versiones`,
      data,
      options,
    ),
  destinos: (ids: number[], signal?: AbortSignal) =>
    api.request<Destino[]>('GET', '/reglas-ajuste/formulas', undefined, {
      ...options,
      signal,
      params: { ids: ids.join(',') },
    }),
  async catalog(
    campo: string,
    parent: string,
    signal?: AbortSignal,
  ): Promise<Opcion[]> {
    const path =
      campo === 'legajo.idEmpresa'
        ? '/empresas'
        : campo === 'legajo.idConvenio'
          ? '/convenios'
          : campo === 'legajo.idCategoria'
            ? `/convenios/${parent}/categorias`
            : campo === 'legajo.modalidadContratacionCodigo'
              ? '/codigosdemodalidaddecontratacion'
              : '/tipoliquidacion';
    type Row = {
      id: number;
      nombre?: string;
      descripcion?: string;
      codigo?: number;
      codigoArca?: number | null;
    };
    const all: Row[] = [];
    for (let page = 1; ; page++) {
      const result = await api.request<Row[] | Page<Row>>(
        'GET',
        path,
        undefined,
        { ...options, signal, params: { page, pageSize: 100 } },
      );
      if (Array.isArray(result)) {
        all.push(...result);
        break;
      }
      all.push(...result.items);
      if (all.length >= result.total || !result.items.length) break;
    }
    return all.flatMap((x) =>
      campo === 'legajo.modalidadContratacionCodigo' && !x.codigoArca
        ? []
        : [
            {
              id:
                campo === 'legajo.modalidadContratacionCodigo'
                  ? x.codigoArca!
                  : x.id,
              nombre: `${campo === 'legajo.modalidadContratacionCodigo' ? x.codigoArca : (x.codigo ?? x.id)} · ${x.nombre ?? x.descripcion ?? ''}`,
            },
          ],
    );
  },
  async legajos(
    page: number,
    buscar: string,
    signal?: AbortSignal,
  ): Promise<Page<Opcion>> {
    const result = await api.request<
      Page<{
        id: number;
        legajo: number | null;
        nombres: string | null;
        apellidos: string | null;
        idEmpresa: number | null;
      }>
    >('GET', '/legajos', undefined, {
      ...options,
      signal,
      params: { page, pageSize: 25, ...(buscar ? { buscar } : {}) },
    });
    return {
      ...result,
      items: result.items.map((x) => ({
        id: x.id,
        nombre: `${x.legajo ?? x.id} · ${x.apellidos ?? ''} ${x.nombres ?? ''} · Empresa ${x.idEmpresa ?? '—'}`,
      })),
    };
  },
};
