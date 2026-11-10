import { ApiClient } from '@/services/http/ApiClient';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';
import type {
  Contexto,
  Empresa,
  Formula,
  Fila,
  Cambio,
  Resultado,
  Liquidacion,
} from '@/features/novedades/types';

export interface LiquidacionFila {
  idLegajo: number;
  numero: number | null;
  nombre: string;
  cuil: string | null;
  idRecibo: number | null;
  pendientes: number;
  formulasPendientes: Formula[];
  errores: string[];
  diasTrabajados: number | null;
  usaDiasCategoria: boolean;
  diasVacaciones: number;
  usaVacacionesPredeterminadas: boolean;
  seleccionable: boolean;
}
export interface Capacidades {
  leer: boolean;
  generar: boolean;
  corregirNovedades: boolean;
}
const api = new ApiClient(config.liquidarBaseURL, {
  ...sessionHttpHooks,
  getAccessToken,
});
const opts = { authenticated: true, timeoutMs: 120000 };
const base = '/liquidaciones';
export const liquidacionesService = {
  capacidades: (signal?: AbortSignal) =>
    api.request<Capacidades>('GET', `${base}/capacidades`, undefined, {
      ...opts,
      signal,
    }),
  tipos: (signal?: AbortSignal) =>
    api.request<{ id: number; nombre: string }[]>(
      'GET',
      `${base}/catalogos/tipos-liquidacion`,
      undefined,
      { ...opts, signal },
    ),
  empresas: (c: Contexto, signal?: AbortSignal) =>
    api.request<Empresa[]>('GET', `${base}/empresas`, undefined, {
      ...opts,
      signal,
      params: { periodo: c.periodo, idTipoLiquidacion: c.idTipoLiquidacion },
    }),
  convenios: (signal?: AbortSignal) =>
    api.request<{ id: number; nombre: string }[]>(
      'GET',
      `${base}/catalogos/convenios`,
      undefined,
      { ...opts, signal },
    ),
  filas: (
    c: Contexto,
    page: number,
    pageSize: number,
    buscar: string,
    signal?: AbortSignal,
    estado = '',
    idConvenio = '',
  ) =>
    api.request<{ items: LiquidacionFila[]; total: number }>(
      'GET',
      `${base}/legajos`,
      undefined,
      {
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
      },
    ),
  liquidar: (
    contexto: Contexto,
    fechaPago: string,
    legajoIds: number[],
    persistir: boolean,
  ) =>
    api.request<Liquidacion>(
      'POST',
      `${base}/${persistir ? 'generar' : 'previsualizar'}`,
      { contexto, fechaPago, legajoIds },
      opts,
    ),
  novedades: (c: Contexto, id: number) =>
    api.request<Fila>('GET', `${base}/legajos/${id}/novedades`, undefined, {
      ...opts,
      params: { ...c },
    }),
  corregir: (contexto: Contexto, cambios: Cambio[]) =>
    api.request<{ items: Resultado[] }>(
      'POST',
      `${base}/corregir-novedades`,
      { contexto, cambios },
      opts,
    ),
};
