import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

import type {
  CostosPoliza,
  CostoPoliza,
  CostoPolizaWrite,
} from '../types/costoPoliza';
import type {
  Empresa,
  EmpresaCompleta,
  EmpresaCompletaWrite,
  EmpresaCatalogos,
  PageResult,
  Provincia,
  TipoReferencia,
  Actividad,
  Banco,
} from '../types/empresa';

const businessMessages = new Set([
  'La póliza debe coincidir con la configuración SCVO vigente de la empresa.',
  'Revise la cobertura SCVO de la nómina antes de publicar el derecho de emisión.',
  'El importe debe coincidir con la escala oficial vigente para la cantidad de asegurados.',
  'Ya existe un derecho anual de emisión o renovación para esta póliza. Revise o anule el cargo anterior.',
  'Empresa no encontrada.',
  'La revisión del cargo cambió. Actualice el historial antes de publicar.',
  'No se pudo publicar el cargo por un conflicto de datos.',
  'No se pudo guardar la empresa completa por un conflicto de datos o relaciones existentes.',
  'No se pudo eliminar la empresa por un conflicto de datos o relaciones existentes.',
  'Un contacto no pertenece a esta empresa o ya no existe.',
  'Una actividad no pertenece a esta empresa o ya no existe.',
  'Un banco no pertenece a esta empresa o ya no existe.',
]);
function parseError(error: ApiError, body: unknown): ApiError {
  if (!body || typeof body !== 'object' || (error.status ?? 500) >= 500)
    return error;
  const detail =
    'detail' in body ? body.detail : 'title' in body ? body.title : null;
  return typeof detail === 'string' && businessMessages.has(detail)
    ? new ApiError(error.kind, detail, error.status, error.fieldErrors)
    : error;
}

export class EmpresaService {
  constructor(private readonly api: ApiClient) {}
  selector(page: number, buscar: string, signal?: AbortSignal) {
    return this.api.request<{
      items: Pick<Empresa, 'id' | 'codigo' | 'nombre' | 'claveUnica'>[];
      page: number;
      pageSize: number;
      total: number;
    }>('GET', '/empresas/selector', undefined, {
      authenticated: true,
      params: { page, pageSize: 25, buscar },
      signal,
    });
  }
  costosPoliza(id: number, periodo: string, signal?: AbortSignal) {
    return this.api.request<CostosPoliza>(
      'GET',
      `/empresas/${id}/costos-poliza`,
      undefined,
      { authenticated: true, params: { periodo }, signal, parseError },
    );
  }
  publicarCostoPoliza(id: number, data: CostoPolizaWrite) {
    return this.api.request<CostoPoliza>(
      'POST',
      `/empresas/${id}/costos-poliza`,
      data,
      { authenticated: true, parseError },
    );
  }
  list(page: number, pageSize: number, signal?: AbortSignal) {
    return this.api.request<PageResult<Empresa>>(
      'GET',
      '/empresas',
      undefined,
      { authenticated: true, params: { page, pageSize }, signal },
    );
  }
  detail(id: number, signal?: AbortSignal) {
    return this.api.request<EmpresaCompleta>(
      'GET',
      `/empresas/${id}/completa`,
      undefined,
      { authenticated: true, signal },
    );
  }
  save(id: number | null, data: EmpresaCompletaWrite) {
    return this.api.request<EmpresaCompleta>(
      id === null ? 'POST' : 'PUT',
      id === null ? '/empresas/completa' : `/empresas/${id}/completa`,
      data,
      { authenticated: true, parseError },
    );
  }
  remove(id: number) {
    return this.api.request<void>('DELETE', `/empresas/${id}`, undefined, {
      authenticated: true,
      parseError,
    });
  }
  async catalogos(signal?: AbortSignal): Promise<EmpresaCatalogos> {
    const options = { authenticated: true, signal };
    const [provincias, tiposClave, tiposEmpresa] = await Promise.all([
      this.api.request<Provincia[]>('GET', '/provincias', undefined, options),
      this.api.request<TipoReferencia[]>(
        'GET',
        '/tipoclaveunica',
        undefined,
        options,
      ),
      this.api.request<TipoReferencia[]>(
        'GET',
        '/tipoempresaafip',
        undefined,
        options,
      ),
    ]);
    return { provincias, tiposClave, tiposEmpresa };
  }
  actividades(signal?: AbortSignal) {
    return this.api.request<Actividad[]>('GET', '/actividades', undefined, {
      authenticated: true,
      signal,
    });
  }
  bancos(page: number, pageSize: number, buscar: string, signal?: AbortSignal) {
    return this.api.request<PageResult<Banco>>('GET', '/bancos', undefined, {
      authenticated: true,
      params: { page, pageSize, buscar },
      signal,
    });
  }
}
export const empresaService = new EmpresaService(
  new ApiClient(config.liquidarBaseURL, {
    ...sessionHttpHooks,
    getAccessToken,
  }),
);
