export interface FieldSpec {
  name: string;
  label: string;
  kind: 'text' | 'date' | 'integer' | 'decimal' | 'boolean' | 'select';
  lookup?: string;
  required?: boolean;
}
export interface Option {
  id: number;
  nombre: string | null;
  codigo?: string | null;
}
export interface Referencias {
  opciones: Record<string, Option[]>;
}
export interface Registro01 {
  id: number;
  idEmpresa: number | null;
  idIdentificacionEnvio: number | null;
  periodo: string | null;
  idTipoLiquidacion: number | null;
  numeroDeLiquidacion: number | null;
  diasBases: number | null;
  cantidadDeRegistros04: number | null;
  generado: boolean;
  exportado: boolean;
  fechaPago: string | null;
  idBanco: number | null;
  version: number;
}
export interface Registro02 {
  id: number;
  idLSDRegistro01: number | null;
  idLegajo: number | null;
  dependenciaRevista: string | null;
  cantDiasProporcionarTope: number | null;
  fechaDePago: string | null;
}
export interface Registro03 {
  id: number;
  idLSDRegistro01: number | null;
  cuil: string | null;
  codigoConcepto: string | null;
  cantidad: string | null;
  informarCantidadLsd?: boolean;
  codigoArcaCantidad?: string | null;
  unidad: string | null;
  importe: string | null;
  debitoCredito: string | null;
  periodoAjuste: string | null;
  idFormulaOrigen: number | null;
  idAsignacionOrigen: number | null;
  origenCodigo: string | null;
}
export interface Registro04 {
  id: number;
  idLSDRegistro01: number | null;
  cuil: string | null;
  conyuge: boolean;
  cantidadHijos: number;
  cct: boolean;
  scvo: boolean;
  reduccion: boolean;
  idTipoEmpresaAfip: number | null;
  tipoOperacion: number | null;
  idCodigoSituacion: number | null;
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
  diasTrabajados: number;
  horaaTrabajadas: number;
  porcentajeAporteAdicionalSS: string | null;
  contribucionTareaDiferencial: string | null;
  codigoObraSocial: string | null;
  cantidadAdherentes: number | null;
  aporteAdicionalOS: string | null;
  contribucionAdicionalOS: string | null;
  bcDiferencialAporteOSyFSR: string | null;
  bcDiferencialOSyFSR: string | null;
  bcDiferencialLRT: string | null;
  remuneracionMaternidadAnses: string | null;
  remuneracionBruta: string | null;
  baseImponible1: string | null;
  baseImponible2: string | null;
  baseImponible3: string | null;
  baseImponible4: string | null;
  baseImponible5: string | null;
  baseImponible6: string | null;
  baseImponible7: string | null;
  baseImponible8: string | null;
  baseImponible9: string | null;
  bcDiferencialAporteSegSocial: string | null;
  bcDiferencialContribSegSocial: string | null;
  baseImponible10: string | null;
  importeADetraer: string | null;
}
export interface Libro {
  cabecera: Registro01;
  registros02: Registro02[];
  registros03: Registro03[];
  registros04: Registro04[];
}
export interface Fila {
  id: number;
  idEmpresa: number | null;
  empresa: string | null;
  periodo: string | null;
  idTipoLiquidacion: number | null;
  tipoLiquidacion: string | null;
  numeroDeLiquidacion: number | null;
  generado: boolean;
  exportado: boolean;
  fechaPago: string | null;
  version: number;
}
export interface Pagina {
  items: Fila[];
  page: number;
  pageSize: number;
  total: number;
}
export interface Concepto {
  id: number;
  idEmpresa: number;
  codigoEmpleador: string;
  descripcion: string;
  codigoArca: string | null;
  activo: boolean;
  version: number;
}
export interface Asignacion {
  id: number;
  idConceptoEmpresa: number;
  idFormula: number;
  periodoDesde: number;
  periodoHasta: number | null;
  version: number;
}
export interface Configuracion {
  conceptos: Concepto[];
  asignaciones: Asignacion[];
}
export interface Cobertura {
  idFormula: number;
  descripcion: string | null;
  codigo: string | null;
  origen: string;
  codigoArca: string | null;
  idAsignacion: number | null;
  error: string | null;
}
export const nuevoLibro = (): Libro => ({
  cabecera: {
    id: 0,
    idEmpresa: null,
    idIdentificacionEnvio: null,
    periodo: '',
    idTipoLiquidacion: null,
    numeroDeLiquidacion: 1,
    diasBases: 30,
    cantidadDeRegistros04: 0,
    generado: false,
    exportado: false,
    fechaPago: null,
    idBanco: null,
    version: 0,
  },
  registros02: [],
  registros03: [],
  registros04: [],
});
