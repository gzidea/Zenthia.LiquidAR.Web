export interface ReciboResumen {
  id: number;
  idEmpresa: number | null;
  idLegajo: number | null;
  periodo: string | null;
  fechaPago: string;
  idTipoLiquidacion: number | null;
  sueldoBruto: string | null;
  totalRemunerativos: string | null;
  totalNoRemunerativos: string | null;
  totalDescuentos: string | null;
  netoACobrar: string | null;
  totalContribuciones: string | null;
  totalCostoLaboral: string | null;
}
export interface ReciboListado {
  recibo: ReciboResumen;
  codigoLegajo: number | null;
  apellidos: string | null;
  nombres: string | null;
  cuil: string | null;
  empresa: string | null;
  tipoLiquidacion: string | null;
}
export interface RecibosFiltro {
  page: number;
  pageSize: number;
  empresaId?: number;
  periodo?: string;
  idTipoLiquidacion?: number;
  buscar: string;
  orden: string;
  descendente: boolean;
}
export interface RecibosPagina {
  items: ReciboListado[];
  total: number;
  page: number;
  pageSize: number;
}
