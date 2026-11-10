export interface Convenio {
  id: number;
  codigo: number | null;
  nombre: string | null;
  descripcion: string | null;
}
export interface Categoria {
  id: number;
  codigo: number | null;
  descripcion: string | null;
  condicionLiquidacion: number | null;
  horasNormales: number | null;
  horasMinimasImponibles: number | null;
  diasMinimosImponibles: number | null;
  idConvenio: number | null;
}
export interface VersionImporte {
  id: number;
  idCategoria: number;
  periodoDesde: string;
  revision: number;
  importe: string | null;
  adicional1: string | null;
  adicional2: string | null;
  origen: string;
  idVersionBase: number | null;
  porcentajeImporte: string | null;
  porcentajeAdicional1: string | null;
  porcentajeAdicional2: string | null;
  motivo: string;
  creadoEn: string;
  creadoPorUserId: number | null;
  creadoPorUserGuid: string | null;
}
export interface CategoriaResumen {
  categoria: Categoria;
  tieneHistoria: boolean;
  escala: { version: VersionImporte; hastaExclusivo: string | null } | null;
  proximaEscala: VersionImporte | null;
  revisionPeriodo: number;
  versionBase: VersionImporte | null;
  escalaInicial?: VersionImporte | null;
}
export interface ConvenioCompleto {
  convenio: Convenio;
  periodo: string;
  periodoOperativo: string;
  categorias: CategoriaResumen[];
}
export interface ImporteRequest {
  periodoDesde: string;
  modo: 'final' | 'porcentaje';
  revisionEsperada: number;
  motivo: string;
  importe?: string | null;
  adicional1?: string | null;
  adicional2?: string | null;
  idVersionBase?: number;
  porcentajeImporte?: string | null;
  porcentajeAdicional1?: string | null;
  porcentajeAdicional2?: string | null;
  confirmarDependencias?: boolean;
  corregirInicial?: boolean;
}
export type CategoriaCambio = Omit<Categoria, 'id' | 'idConvenio'> & {
  id: number | null;
  escalaInicial?: ImporteRequest | null;
};
export interface ConvenioWrite {
  convenio: Omit<Convenio, 'id'>;
  categorias: CategoriaCambio[];
  categoriasEliminar: number[];
}
export interface ImportesRequest {
  categorias: { idCategoria: number; propuesta: ImporteRequest }[];
}
export interface ImportesPropuesta {
  categorias: {
    version: VersionImporte;
    versionesDependientes: number[];
    persistido: boolean;
  }[];
  persistido: boolean;
}
export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
