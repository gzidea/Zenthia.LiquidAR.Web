export interface LegajoData {
  legajo: number | null;
  idEmpresa: number | null;
  nombres: string | null;
  apellidos: string | null;
  cuil: string | null;
  tareas: string | null;
  fechaIngreso: string | null;
  fechaIngresoReconocida: string | null;
  fechaEgreso: string | null;
  idConvenio: number | null;
  condicionliquidacion: number | null;
  fueraconvenio: boolean;
  idCategoria: number | null;
  idSindicato: number | null;
  idObrasocial: number | null;
  sueldo: string | null;
  adicional: string | null;
  idJornada: number | null;
  idActividad: number | null;
  idFormaDePago: number | null;
  idEstadoCivil: number | null;
  adherentes: number | null;
  hijos: number | null;
  conyuge: boolean | null;
  domicilio: string | null;
  localidad: string | null;
  idProvincia: number | null;
  fechaNacimiento: string | null;
  cbu: string | null;
  idCodigoCondicion: number | null;
  idCodigoActividad: number | null;
  idCodigoModalidadContratacion: number | null;
  idCodigoSiniestrado: number | null;
  idCodigoLocalidad: number | null;
  idSituacionRevista1: number | null;
  diaInicioRevista1: number | null;
  idSituacionRevista2: number | null;
  diaInicioRevista2: number | null;
  idSituacionRevista3: number | null;
  diaInicioRevista3: number | null;
}
export interface Legajo extends LegajoData {
  id: number;
  empresaNombre?: string | null;
  convenioNombre?: string | null;
  categoriaNombre?: string | null;
}
export interface Concepto {
  id: number | null;
  idLegajo: number | null;
  idFormula: number | null;
  idTipoLiquidacion: number | null;
  importe: string | null;
  cantidad: number | null;
  activo: boolean;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
}
export interface Completo {
  legajo: Legajo;
  conceptos: Concepto[];
  antiguedad: string;
  situacionRevistaActual?: string | null;
}
export interface Write {
  legajo: LegajoData;
  conceptos: { id: number | null; datos: Omit<Concepto, 'id'> }[];
  conceptosEliminar: number[];
}
export interface Opcion {
  id: number;
  nombre: string | null;
}
export interface PageResult {
  items: Legajo[];
  total: number;
  page: number;
  pageSize: number;
}
export const label = (x: Opcion) => x.nombre ?? `ID ${x.id}`;
