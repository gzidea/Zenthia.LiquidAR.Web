export interface SindicatoWrite {
  codigo: string | null;
  nombre: string | null;
  direccion: string | null;
  localidad: string | null;
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
export interface Sindicato extends SindicatoWrite {
  id: number;
  provinciaNombre: string | null;
}
export interface SindicatosPageResult {
  items: Sindicato[];
  page: number;
  pageSize: number;
  total: number;
}
export type { Provincia } from '@/types/provincia';
