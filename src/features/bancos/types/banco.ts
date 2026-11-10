export interface BancoWrite {
  codigoEntidad: number;
  denominacion: string | null;
  abreviacion: string | null;
}
export interface Banco extends BancoWrite {
  id: number;
}
export interface BancosPageResult {
  items: Banco[];
  page: number;
  pageSize: number;
  total: number;
}
export interface BcraImportResult {
  incorporados: number;
  omitidos: number;
  fallidos: { codigoEntidad: number; motivo: string }[];
}
