export interface ObraSocialWrite {
  codigo: string | null;
  nombre: string | null;
  direccion: string | null;
  codigoPostal: number | null;
  idProvincia: number | null;
  email: string | null;
  telefono: string | null;
  porcientoAporte: number | null;
  porcientoRetencion: number | null;
  importeAporte: string | null;
  importeRetencion: string | null;
  baseDeCalculo: string | null;
}
export interface ObraSocial extends ObraSocialWrite {
  id: number;
  localidad: string | null;
  provinciaNombre: string | null;
}
export interface ObrasSocialesPageResult {
  items: ObraSocial[];
  page: number;
  pageSize: number;
  total: number;
}
export type { Provincia } from '@/types/provincia';
