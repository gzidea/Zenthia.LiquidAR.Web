export interface FormulaData {
  codigo: number | null;
  codigoAfip: number | null;
  conceptoId: number | null;
  convenioId: number | null;
  descripcion: string | null;
  formulaCantidad: string | null;
  formulaBase: string | null;
  formulaImporte: string | null;
  unidadId: number | null;
  visible: boolean;
  activo: boolean;
  orden: number | null;
  afectaMejorSueldo: boolean;
  afectaImpuestoGanancia: boolean;
  incluirDescripcionConcepto: boolean;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
  sumaAlBasico: boolean;
  cargarComoNovedad: boolean | null;
  auxiliar: boolean;
  informarCantidadLsd?: boolean;
}
export interface Formula extends FormulaData {
  id: number;
  convenioNombre: string | null;
  conceptoDescripcion: string | null;
  unidadDescripcion: string | null;
  variable: string;
  descripcionCompleta: string | null;
}
export interface Periodo {
  id: number | null;
  numeroMes: number | null;
  seleccionado: boolean;
  mesNombre?: string | null;
}
export interface Tipo {
  id: number | null;
  idTipoLiquidacion: number | null;
  seleccionado: boolean;
  tipoLiquidacionDescripcion?: string | null;
}
export interface FormulaCompleta {
  formula: Formula;
  periodos: Periodo[];
  tiposLiquidacion: Tipo[];
}
export interface FormulaWrite {
  formula: FormulaData;
  periodos: Periodo[];
  tiposLiquidacion: Tipo[];
  periodosEliminar: number[];
  tiposLiquidacionEliminar: number[];
}
export interface FormulaOrderRow {
  id: number;
  codigo: number | null;
  descripcion: string | null;
  variable: string;
  orden: number | null;
  activo: boolean;
}
export interface FormulaOrder {
  formulas: FormulaOrderRow[];
  huella: string;
}
export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface Catalogo {
  id: number;
  nombre?: string | null;
  descripcion?: string | null;
  nombreMes?: string | null;
  codigo?: number | null;
  columnaRecibo?: number;
}
export type CatalogKind =
  'convenios' | 'conceptos' | 'unidades' | 'meses' | 'tipoliquidacion';
export const catalogLabel = (x: Catalogo) =>
  x.nombre ?? x.descripcion ?? x.nombreMes ?? `ID ${x.id}`;
export const columnaReciboLabel = (value: number | undefined) =>
  value === undefined
    ? 'No disponible en el catálogo consultado'
    : ([
        'Remunerativo',
        'Descuento',
        'No remunerativo',
        'Descuento no remunerativo',
        'Contribuciones',
      ][value] ?? String(value));
export interface Filtros {
  buscar: string;
  convenioId: string;
  activo: string;
}
