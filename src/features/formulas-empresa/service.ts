import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { z } from 'zod';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';
import type {
  Catalogo,
  Formula,
  FormulaData,
} from '@/features/formulas/types/formula';

export interface Convenio {
  id: number;
  nombre: string | null;
  habilitado: boolean;
}
export interface ConvenioConfigurado extends Convenio {
  agregado: boolean;
}
export interface OpcionFormula {
  id: number;
  codigo: number | null;
  descripcion: string | null;
  convenioId: number | null;
  columna: number | null;
  idEmpresa: number | null;
}
export interface Agrupacion {
  id: number;
  idEmpresa: number;
  descripcion: string;
  orden: number;
  periodoDesde: string;
  periodoHasta: string | null;
  activa: boolean;
  formulas: number[];
  revision: number;
}
export interface AgrupacionWrite {
  descripcion: string;
  orden: number;
  periodoDesde: string;
  periodoHasta: string | null;
  activa: boolean;
  formulas: number[];
  revisionEsperada: number;
}
export interface Exclusion {
  id: number;
  idFormula: number;
  periodoDesde: string;
  periodoHasta: string | null;
  activa: boolean;
  revision: number;
}
export interface ExclusionWrite extends Omit<Exclusion, 'id' | 'revision'> {
  revisionEsperada: number;
}
export interface Publicacion {
  id: number;
  idEmpresa: number | null;
  idFormulaCentralOrigen: number | null;
  revision: number;
  periodoDesde: string | null;
  periodoHasta: string | null;
  publicacion: {
    formula: Formula;
    meses: number[];
    tiposLiquidacion: number[];
    descripcionCompleta: string;
  } | null;
}
export interface PublicacionWrite {
  formula: FormulaData;
  meses: number[];
  tiposLiquidacion: number[];
  periodoDesde: string;
  periodoHasta: string | null;
  revisionEsperada: number;
  idFormulaCentralOrigen: number | null;
}
export interface Catalogos {
  convenios: Convenio[];
  conceptos: Catalogo[];
  unidades: Catalogo[];
  meses: Catalogo[];
  tiposLiquidacion: Catalogo[];
}
const businessMessages = new Set([
  'Una fórmula ya pertenece a otra agrupación con vigencia superpuesta.',
  'Solo se pueden agrupar fórmulas de una misma columna del recibo.',
  'Hay fórmulas ajenas o de convenios no habilitados.',
  'La agrupación cambió. Vuelva a consultarla.',
  'La fórmula cambió. Vuelva a consultar su revisión.',
  'El convenio no está habilitado para el tenant de la empresa.',
  'No se puede cambiar el ámbito de una regla existente.',
  'Seleccione entre 1 y 1000 convenios distintos.',
  'Uno o más convenios ya fueron agregados. Actualice el listado.',
  'El convenio cambió. Vuelva a consultar.',
  'Convenio no encontrado.',
]);
const options = {
  authenticated: true,
  parseError: (error: ApiError, body: unknown) => {
    const detail =
      body && typeof body === 'object' && 'detail' in body ? body.detail : null;
    return typeof detail === 'string' && businessMessages.has(detail)
      ? new ApiError(error.kind, detail, error.status, error.fieldErrors)
      : error;
  },
};
export class FormulasEmpresaApi {
  constructor(private readonly api: ApiClient) {}
  empresas(page: number, buscar: string, signal?: AbortSignal) {
    return this.api.request<{
      items: EmpresaFormulaSelector[];
      page: number;
      pageSize: number;
      total: number;
    }>('GET', '/configuracion/formulas-empresa/empresas', undefined, {
      ...options,
      params: { page, pageSize: 25, buscar },
      signal,
    });
  }
  empresa(id: number, signal?: AbortSignal) {
    return this.api.request<EmpresaFormulaSelector>(
      'GET',
      `/configuracion/formulas-empresa/empresas/${id}`,
      undefined,
      { ...options, signal },
    );
  }
  catalogosCentrales(signal?: AbortSignal) {
    return this.api.request<Catalogos>(
      'GET',
      '/configuracion/formulas-empresa/catalogos-centrales',
      undefined,
      { ...options, signal },
    );
  }
  borradorCentral(id: number, signal?: AbortSignal) {
    return this.api.request<Publicacion>(
      'GET',
      `/formulas/${id}/borrador-publicacion`,
      undefined,
      { ...options, signal },
    );
  }
  publicarCentral(id: number, data: PublicacionWrite) {
    return this.api.request<Publicacion>(
      'POST',
      `/formulas/${id}/publicaciones`,
      data,
      options,
    );
  }
  async conveniosTenant(signal?: AbortSignal): Promise<ConvenioConfigurado[]> {
    const result = await this.api.request<unknown>(
      'GET',
      '/configuracion/convenios-habilitados',
      undefined,
      { ...options, signal },
    );
    const parsed = z
      .array(
        z.object({
          id: z.number().int().positive(),
          nombre: z.string().nullable(),
          habilitado: z.boolean(),
          agregado: z.boolean(),
        }),
      )
      .safeParse(result);
    if (!parsed.success)
      throw new ApiError(
        'contract',
        'No se pudo validar la configuración de convenios.',
      );
    return parsed.data;
  }
  agregarConvenios(convenios: number[]) {
    return this.api.request<boolean>(
      'POST',
      '/configuracion/convenios-habilitados',
      { convenios },
      options,
    );
  }
  habilitarTenant(id: number, habilitado: boolean) {
    return this.api.request<boolean>(
      'PUT',
      `/configuracion/convenios-habilitados/${id}`,
      { habilitado },
      options,
    );
  }
  convenios(empresa: number, signal?: AbortSignal) {
    return this.api.request<Convenio[]>(
      'GET',
      `/empresas/${empresa}/convenios-habilitados`,
      undefined,
      { ...options, signal },
    );
  }
  habilitar(empresa: number, id: number, habilitado: boolean) {
    return this.api.request<boolean>(
      'PUT',
      `/empresas/${empresa}/convenios-habilitados/${id}`,
      { habilitado },
      options,
    );
  }
  agrupaciones(empresa: number, signal?: AbortSignal) {
    return this.api.request<Agrupacion[]>(
      'GET',
      `/empresas/${empresa}/agrupaciones-formulas`,
      undefined,
      { ...options, signal },
    );
  }
  opciones(empresa: number, signal?: AbortSignal) {
    return this.api.request<OpcionFormula[]>(
      'GET',
      `/empresas/${empresa}/agrupaciones-formulas/formulas`,
      undefined,
      { ...options, signal },
    );
  }
  guardarGrupo(empresa: number, id: number | null, data: AgrupacionWrite) {
    return this.api.request<Agrupacion>(
      id === null ? 'POST' : 'PUT',
      `/empresas/${empresa}/agrupaciones-formulas${id === null ? '' : `/${id}`}`,
      data,
      options,
    );
  }
  propias(empresa: number, signal?: AbortSignal) {
    return this.api.request<Publicacion[]>(
      'GET',
      `/empresas/${empresa}/formulas-propias`,
      undefined,
      { ...options, signal },
    );
  }
  catalogos(empresa: number, signal?: AbortSignal) {
    return this.api.request<Catalogos>(
      'GET',
      `/empresas/${empresa}/formulas-propias/catalogos`,
      undefined,
      { ...options, signal },
    );
  }
  central(empresa: number, id: number, signal?: AbortSignal) {
    return this.api.request<Publicacion>(
      'GET',
      `/empresas/${empresa}/formulas-propias/central/${id}`,
      undefined,
      { ...options, signal },
    );
  }
  publicar(empresa: number, id: number | null, data: PublicacionWrite) {
    return this.api.request<Publicacion>(
      id === null ? 'POST' : 'PUT',
      `/empresas/${empresa}/formulas-propias${id === null ? '' : `/${id}`}`,
      data,
      options,
    );
  }
  exclusiones(empresa: number, signal?: AbortSignal) {
    return this.api.request<Exclusion[]>(
      'GET',
      `/empresas/${empresa}/formulas-propias/exclusiones`,
      undefined,
      { ...options, signal },
    );
  }
  guardarExclusion(empresa: number, id: number | null, data: ExclusionWrite) {
    return this.api.request<Exclusion>(
      id === null ? 'POST' : 'PUT',
      `/empresas/${empresa}/formulas-propias/exclusiones${id === null ? '' : `/${id}`}`,
      data,
      options,
    );
  }
}

export interface EmpresaFormulaSelector {
  id: number;
  codigo: number | null;
  nombre: string | null;
  claveUnica: string | null;
}
export const formulasEmpresaApi = new FormulasEmpresaApi(
  new ApiClient(config.liquidarBaseURL, {
    ...sessionHttpHooks,
    getAccessToken,
  }),
);
