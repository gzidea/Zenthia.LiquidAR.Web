export interface Contexto {
  idEmpresa: number;
  periodo: string;
  idTipoLiquidacion: number;
}
export interface Valor {
  idFormula: number;
  cantidad: number | null;
  importe: string | null;
  observaciones: string | null;
}
export interface Formula {
  id: number;
  codigo: string | null;
  descripcion: string | null;
}
export interface Fila {
  idLegajo: number;
  numero: number | null;
  nombre: string;
  cuil: string | null;
  idConvenio: number | null;
  idNovedad: number | null;
  revision: number;
  fechaPago: string | null;
  diasTrabajados: number | null;
  horasTrabajadas: number | null;
  diasVacaciones: number | null;
  requeridas: Formula[];
  detalles: Valor[];
  errores: string[];
  pendientes: number;
  idRecibo: number | null;
}
export interface Cambio {
  idLegajo: number;
  revisionEsperada: number;
  fechaPago: string;
  diasTrabajados: number | null;
  horasTrabajadas: number | null;
  diasVacaciones: number | null;
  detalles: Valor[];
  quitarFormulas: number[];
}
export interface Empresa {
  id: number;
  nombre: string;
  legajos: number;
  conNovedades: number;
  recibos: number;
}
export interface Pagina {
  items: Fila[];
  page: number;
  pageSize: number;
  total: number;
  conPendientes: number;
  conErrores: number;
  conRecibo: number;
}
export interface Resultado {
  idLegajo: number;
  estado: string;
  error: string | null;
}
export interface Recibo {
  vista?: unknown;
  reciboId: number | null;
  calculado: boolean;
  persistido: boolean;
  cabecera: Record<string, unknown> | null;
  detalles: Record<string, unknown>[];
  diagnosticos: {
    formulaId: number | null;
    descripcion: string | null;
    codigo: string;
    mensaje: string;
    campo: string | null;
  }[];
}
export interface Liquidacion {
  items: {
    idLegajo: number;
    estado: string;
    error: string | null;
    recibo: Recibo | null;
  }[];
}
export interface RevisionImportacion {
  cambios: Cambio[];
  errores: string[];
  originales: Fila[];
}
export interface Draft {
  original: Fila;
  fechaPago: string;
  diasTrabajados: string;
  horasTrabajadas: string;
  diasVacaciones: string;
  detalles: Record<
    number,
    { cantidad: string; importe: string; observaciones: string }
  >;
  quitarFormulas: number[];
}
export const draftOf = (r: Fila, fecha: string): Draft => ({
  original: r,
  fechaPago: r.fechaPago ?? fecha,
  diasTrabajados: r.diasTrabajados?.toString() ?? '',
  horasTrabajadas: r.horasTrabajadas?.toString() ?? '',
  diasVacaciones: r.diasVacaciones?.toString() ?? '',
  detalles: Object.fromEntries(
    r.detalles.map((d) => [
      d.idFormula,
      {
        cantidad: d.cantidad?.toString() ?? '',
        importe: d.importe ?? '',
        observaciones: d.observaciones ?? '',
      },
    ]),
  ),
  quitarFormulas: [],
});
