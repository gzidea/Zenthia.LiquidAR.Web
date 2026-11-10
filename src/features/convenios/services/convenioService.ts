import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';

import type {
  Convenio,
  ConvenioCompleto,
  ConvenioWrite,
  ImportesRequest,
  ImportesPropuesta,
  PageResult,
  VersionImporte,
} from '../types/convenio';

const messages = new Set([
  'La corrección inicial sólo admite importes finales para el primer período existente, sin cambiar su fecha.',
  'No se pudo eliminar el convenio por un conflicto de datos o relaciones existentes.',
  'La versión ya no es la última vigente del inicio indicado.',
  'Sólo se pueden anular programaciones futuras.',
  'No se puede anular el primer inicio: dejaría períodos sin cobertura.',
  'Confirme la anulación: la escala anterior continuará vigente y las escalas dependientes conservarán sus importes.',
  'Convenio no encontrado.',
  'Categoría no encontrada.',
  'Después de la carga inicial sólo se pueden programar o revisar meses futuros.',
  'La revisión cambió. Consulte el historial y vuelva a previsualizar.',
  'La versión base cambió. Consulte el mes anterior y vuelva a previsualizar.',
  'No hay escala base vigente en el mes anterior; cargue importes finales para la primera escala.',
  'No se puede aplicar un porcentaje a un importe base null.',
  'El ajuste excede la precisión numeric(19,4).',
  'Hay escalas dependientes. Confirme conservar sus importes finales o programe sus revisiones explícitamente.',
  'No se puede eliminar una categoría con historia de importes.',
  'Una categoría no pertenece a este convenio o ya no existe.',
  'No se pudo guardar el convenio y sus categorías por un conflicto de datos. No se guardaron cambios parciales.',
]);
export function parseConvenioError(error: ApiError, body: unknown): ApiError {
  if (!body || typeof body !== 'object' || (error.status ?? 500) >= 500)
    return error;
  const detail = 'detail' in body ? body.detail : null;
  if (typeof detail !== 'string') return error;
  const plain = detail.replace(/^Categoría \d+: /, '');
  return messages.has(plain)
    ? new ApiError(error.kind, detail, error.status, error.fieldErrors)
    : error;
}
const options = { authenticated: true, parseError: parseConvenioError };
export class ConvenioService {
  constructor(private readonly api: ApiClient) {}
  list(page: number, pageSize: number, signal?: AbortSignal) {
    return this.api.request<PageResult<Convenio>>(
      'GET',
      '/convenios',
      undefined,
      { ...options, params: { page, pageSize }, signal },
    );
  }
  detail(id: number, periodo?: string, signal?: AbortSignal) {
    return this.api.request<ConvenioCompleto>(
      'GET',
      `/convenios/${id}/completo`,
      undefined,
      { ...options, params: periodo ? { periodo } : {}, signal },
    );
  }
  save(id: number | null, data: ConvenioWrite) {
    return this.api.request<ConvenioCompleto>(
      id === null ? 'POST' : 'PUT',
      id === null ? '/convenios/completo' : `/convenios/${id}/completo`,
      data,
      options,
    );
  }
  remove(id: number) {
    return this.api.request<void>(
      'DELETE',
      `/convenios/${id}`,
      undefined,
      options,
    );
  }
  importes(id: number, data: ImportesRequest, persistir: boolean) {
    return this.api.request<ImportesPropuesta>(
      'POST',
      `/convenios/${id}/importes${persistir ? '' : '/previsualizar'}`,
      data,
      options,
    );
  }
  historial(id: number, page: number, pageSize: number, signal?: AbortSignal) {
    return this.api.request<PageResult<VersionImporte>>(
      'GET',
      `/convenios/categorias/${id}/importes/historial`,
      undefined,
      { ...options, params: { page, pageSize }, signal },
    );
  }
  anular(
    id: number,
    version: number,
    revisionEsperada: number,
    motivo: string,
    confirmarDependencias: boolean,
  ) {
    return this.api.request(
      'POST',
      `/convenios/categorias/${id}/importes/${version}/anular`,
      {
        revisionEsperada,
        motivo,
        confirmarAnulacion: true,
        confirmarDependencias,
      },
      options,
    );
  }
}
export const convenioService = new ConvenioService(
  new ApiClient(config.liquidarBaseURL, {
    ...sessionHttpHooks,
    getAccessToken,
  }),
);
