export interface ReciboPreviewDetalle {
  id: string;
  formulaId: number | null;
  descripcion: string;
  cantidad: number | null;
  base: number | null;
  importe: number | null;
  remunerativo: number | null;
  noRemunerativo: number | null;
  descuento: number | null;
  contribuciones: number | null;
}
export interface ReciboPreviewData {
  origen: 'simulacion' | 'guardado';
  empresa: string;
  domicilio: string | null;
  cuit: string | null;
  cuil: string | null;
  legajo: number | null;
  legajoFicticio?: boolean;
  lugarPago: string | null;
  fechaPagoAportes: string | null;
  errorIntegridad: string | null;
  camposInconsistentes: string[];
  nota: string;
  grafico?: { titulo: string; importe: number }[];
  calculado: boolean;
  nombre: string;
  fechaIngreso: string | null;
  convenio: string;
  categoria: string;
  periodo: string;

  antiguedad: string;
  importeCategoria: number | null;
  detalles: ReciboPreviewDetalle[];
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
