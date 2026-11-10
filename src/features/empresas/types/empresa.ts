import type { Banco } from '@/features/bancos/types/banco';
export type { Banco };
export interface EmpresaWrite {
  codigo: number | null;
  nombre: string | null;
  direccion: string | null;
  localidad: string | null;
  codigoPostal: number | null;
  idProvincia: number | null;
  idTipoClaveUnica: number | null;
  claveUnica: string | null;
  email: string | null;
  telefono: string | null;
  idTipoEmpresaAfip: number | null;
}
export interface Empresa extends EmpresaWrite {
  id: number;
}
export interface Contacto {
  id: number;
  idEmpresa: number | null;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
}
export interface EmpresaActividad {
  id: number;
  idEmpresa: number | null;
  idActividad: number | null;
  codigoAfip: number | null;
  actividad: string | null;
  valorSeguro: string;
  activo: boolean;
}
export interface EmpresaBanco {
  id: number;
  idEmpresa: number;
  idBanco: number;
  banco: string | null;
  abreviacion: string | null;
  activo: boolean;
}
export interface EmpresaCompleta {
  empresa: Empresa;
  contactos: Contacto[];
  actividades: EmpresaActividad[];
  bancos: EmpresaBanco[];
}
export interface EmpresaCompletaWrite {
  empresa: EmpresaWrite;
  contactos: (Omit<Contacto, 'id' | 'idEmpresa'> & { id: number | null })[];
  actividades: {
    id: number | null;
    idActividad: number | null;
    valorSeguro: string;
    activo: boolean;
  }[];
  bancos: { id: number | null; idBanco: number; activo: boolean }[];
  contactosEliminar: number[];
  actividadesEliminar: number[];
  bancosEliminar: number[];
}
export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface Provincia {
  id: number;
  nombre: string | null;
}
export interface TipoReferencia {
  id: number;
  descripcion: string | null;
}
export interface Actividad extends TipoReferencia {
  codigoAfip: number | null;
  descripcionAdicional: string | null;
}
export interface EmpresaCatalogos {
  provincias: Provincia[];
  tiposClave: TipoReferencia[];
  tiposEmpresa: TipoReferencia[];
}
