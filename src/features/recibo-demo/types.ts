export interface DemoOpcion {
  id: number;
  nombre: string;
}
export interface DemoInicio {
  periodoInicial: string;
  tipoLiquidacion: string;
  fechaReferencia: string;
  jornadaHoras: number;
  nombre: string;
  fechaIngreso: string;
  convenios: DemoOpcion[];
  seguros?: {
    regimen: string;
  } | null;
}
export interface DemoRequest {
  nombre: string;
  fechaIngreso: string;
  convenioId: number;
  categoriaId: number;
  periodo: string;
}
export interface DemoDetalle {
  formulaId: number;
  descripcion: string;
  cantidad: number | null;
  base: number | null;
  importe: number | null;
  remunerativo: number | null;
  noRemunerativo: number | null;
  descuento: number | null;
  contribuciones: number | null;
}
export interface DemoResultado {
  calculado: boolean;
  nombre: string;
  fechaIngreso: string;
  convenio: string;
  categoria: string;
  periodo: string;
  fechaReferencia: string;
  antiguedad: string;
  importeCategoria: number | null;
  detalles: DemoDetalle[];
  totales: null | {
    remunerativo: number;
    noRemunerativo: number;
    descuentos: number;
    contribuciones: number;
    bruto: number;
    neto: number;
    costoTotal: number;
  };
  grupos: {
    idGrupoCosto: number;
    titulo: string;
    empleador: number;
    trabajador: number;
    total: number;
  }[];
  diagnosticos: { codigo: string; mensaje: string; concepto: string | null }[];
}
