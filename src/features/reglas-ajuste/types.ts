export interface Condicion {
  campo: string;
  operador: string;
  valores?: number[];
  valor?: string;
  referencia?: string;
  desplazamientoMeses?: number;
  duracionMeses?: number;
  incluirMesInicial?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
}
export interface Operacion {
  tipo: string;
  valor: string;
  expresionBase?: string | null;
  fuenteMensual?: string | null;
}
export interface ReglaWrite {
  centralizada?: boolean;
  nombre: string;
  periodoDesde: string;
  periodoHasta: string | null;
  activa: boolean;
  formulas: number[];
  condiciones: Condicion[];
  ajuste: Operacion;
  motivo: string;
  revisionEsperada: number;
}
export interface Version extends Omit<
  ReglaWrite,
  'nombre' | 'revisionEsperada'
> {
  id: number;
  idRegla: number;
  revision: number;
  creadoEn: string;
  creadoPorUserId: number;
  creadoPorUserGuid: string;
}
export interface Regla {
  centralizada?: boolean;
  id: number;
  nombre: string;
  revisionActual: number;
  estado: string | null;
  versionPeriodo: {
    id: number;
    revision: number;
    periodoDesde: string;
    periodoHasta: string | null;
    activa: boolean;
    tipoAjuste: string;
  } | null;
}
export interface Detalle {
  regla: Regla;
  ultimaVersion: Version | null;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Destino {
  id: number;
  codigo: number | null;
  descripcion: string | null;
  convenioId: number | null;
  convenioNombre: string | null;
  activo: boolean;
}
export interface Filtros {
  buscar: string;
  periodo: string;
  estado: string;
}
export interface Opcion {
  id: number;
  nombre: string;
}
export const operaciones: Record<string, string> = {
  reduccionPorcentual: 'Reducción porcentual',
  incrementoPorcentual: 'Incremento porcentual',
  ajusteImporteFijo: 'Ajuste de importe fijo',
  fijarImporte: 'Fijar importe final',
  fijarImporteMensual: 'Fijar importe mensual (por diferencias)',
  fijarAlicuota: 'Fijar alícuota sobre base',
};
export const estados: Record<string, string> = {
  activa: 'Activa',
  inactiva: 'Inactiva',
  vencida: 'Vencida',
  sinVersion: 'Sin versión para el período',
};
export const campos: Record<string, string> = {
  'legajo.id': 'Legajo',
  'legajo.idEmpresa': 'Empresa',
  'legajo.idConvenio': 'Convenio',
  'legajo.idCategoria': 'Categoría',
  'legajo.modalidadContratacionCodigo': 'Modalidad (código ARCA)',
  'recibo.idTipoLiquidacion': 'Tipo de liquidación',
  'beneficios.vigentes': 'Beneficio vigente',
  'legajo.fechaIngreso': 'Fecha de ingreso',
  'recibo.periodo': 'Ventana desde el ingreso',
};
export const month = (date: string | null | undefined) =>
  date?.slice(0, 7) ?? '';
export const periodoApi = (value: string) =>
  value.slice(5, 7) + value.slice(0, 4);
export const periodoTexto = (value: string | null | undefined) =>
  value ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : 'Sin límite';
export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export function nuevaCondicion(campo: string): Condicion {
  if (campo === 'beneficios.vigentes')
    return { campo, operador: 'contiene', valor: '' };
  if (campo === 'legajo.fechaIngreso')
    return { campo, operador: 'entreFechas', fechaDesde: '', fechaHasta: '' };
  if (campo === 'recibo.periodo')
    return {
      campo,
      operador: 'dentroDeVentanaMensual',
      referencia: 'legajo.fechaIngreso',
      desplazamientoMeses: 0,
      duracionMeses: 12,
      incluirMesInicial: true,
    };
  return { campo, operador: 'igual', valores: [] };
}
export function resumen(c: Condicion) {
  const label = campos[c.campo] ?? c.campo;
  if (c.operador === 'contiene')
    return `${label}: ${c.valor || 'sin completar'}`;
  if (c.operador === 'entreFechas')
    return `${label}: entre ${c.fechaDesde || '…'} y ${c.fechaHasta || '…'} (inclusive)`;
  if (c.operador === 'dentroDeVentanaMensual')
    return `${c.duracionMeses} meses desde el ingreso, desplazamiento ${c.desplazamientoMeses}; ${c.incluirMesInicial ? 'incluye' : 'excluye'} el mes inicial`;
  return `${label} ${c.operador === 'en' ? 'pertenece a' : c.operador === 'entre' ? 'entre IDs/códigos' : 'igual a'} ${(c.valores ?? []).join(', ') || 'sin completar'}`;
}
