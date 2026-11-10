import type { FieldSpec } from './types';
export const fields01: FieldSpec[] = [
  {
    name: 'idEmpresa',
    label: 'Empresa',
    kind: 'select',
    lookup: 'empresas',
    required: true,
  },
  {
    name: 'idIdentificacionEnvio',
    label: 'Identificación del envío',
    kind: 'select',
    lookup: 'envios',
    required: true,
  },
  {
    name: 'periodo',
    label: 'Período (MMAAAA)',
    kind: 'text',
  },
  {
    name: 'idTipoLiquidacion',
    label: 'Tipo de liquidación',
    kind: 'select',
    lookup: 'tipos',
    required: true,
  },
  {
    name: 'numeroDeLiquidacion',
    label: 'N.º liquidación',
    kind: 'integer',
  },
  {
    name: 'diasBases',
    label: 'Días base',
    kind: 'integer',
  },
  {
    name: 'cantidadDeRegistros04',
    label: 'Cantidad registros 04',
    kind: 'integer',
  },
];
export const fields02: FieldSpec[] = [
  {
    name: 'idLegajo',
    label: 'Legajo',
    kind: 'select',
    lookup: 'legajos',
  },
  {
    name: 'dependenciaRevista',
    label: 'Dependencia de revista',
    kind: 'text',
  },
  {
    name: 'cantDiasProporcionarTope',
    label: 'Días para proporcionar tope',
    kind: 'integer',
  },
  {
    name: 'fechaDePago',
    label: 'Fecha de pago (AAAAMMDD)',
    kind: 'text',
  },
];
export const fields03: FieldSpec[] = [
  {
    name: 'informarCantidadLsd',
    label: 'Informar cantidad en TXT',
    kind: 'boolean',
  },
  {
    name: 'cuil',
    label: 'CUIL',
    kind: 'text',
  },
  {
    name: 'codigoConcepto',
    label: 'Código del empleador',
    kind: 'text',
  },
  {
    name: 'cantidad',
    label: 'Cantidad',
    kind: 'decimal',
  },
  {
    name: 'unidad',
    label: 'Unidad',
    kind: 'text',
  },
  {
    name: 'importe',
    label: 'Importe',
    kind: 'decimal',
  },
  {
    name: 'debitoCredito',
    label: 'Débito / Crédito',
    kind: 'text',
  },
  {
    name: 'periodoAjuste',
    label: 'Ajuste (AAAAMM)',
    kind: 'text',
  },
];
export const fields04: FieldSpec[] = [
  {
    name: 'cuil',
    label: 'CUIL',
    kind: 'text',
  },
  {
    name: 'conyuge',
    label: 'Cónyuge',
    kind: 'boolean',
  },
  {
    name: 'cantidadHijos',
    label: 'Cantidad de hijos',
    kind: 'integer',
  },
  {
    name: 'cct',
    label: 'En convenio',
    kind: 'boolean',
  },
  {
    name: 'scvo',
    label: 'SCVO',
    kind: 'boolean',
  },
  {
    name: 'reduccion',
    label: 'Reducción',
    kind: 'boolean',
  },
  {
    name: 'idTipoEmpresaAfip',
    label: 'Tipo de empleador',
    kind: 'select',
    lookup: 'tipoEmpresa',
  },
  {
    name: 'tipoOperacion',
    label: 'Tipo de operación',
    kind: 'integer',
  },
  {
    name: 'idCodigoSituacion',
    label: 'Situación de revista',
    kind: 'select',
    lookup: 'situaciones',
  },
  {
    name: 'idCodigoCondicion',
    label: 'Condición',
    kind: 'select',
    lookup: 'condiciones',
  },
  {
    name: 'idCodigoActividad',
    label: 'Actividad',
    kind: 'select',
    lookup: 'actividades',
  },
  {
    name: 'idCodigoModalidadContratacion',
    label: 'Modalidad de contratación',
    kind: 'select',
    lookup: 'modalidades',
  },
  {
    name: 'idCodigoSiniestrado',
    label: 'Siniestrado',
    kind: 'select',
    lookup: 'siniestros',
  },
  {
    name: 'idCodigoLocalidad',
    label: 'Localidad',
    kind: 'select',
    lookup: 'localidades',
  },
  {
    name: 'idSituacionRevista1',
    label: 'Situación de revista 1',
    kind: 'select',
    lookup: 'situaciones',
  },
  {
    name: 'diaInicioRevista1',
    label: 'Día inicio revista 1',
    kind: 'integer',
  },
  {
    name: 'idSituacionRevista2',
    label: 'Situación de revista 2',
    kind: 'select',
    lookup: 'situaciones',
  },
  {
    name: 'diaInicioRevista2',
    label: 'Día inicio revista 2',
    kind: 'integer',
  },
  {
    name: 'idSituacionRevista3',
    label: 'Situación de revista 3',
    kind: 'select',
    lookup: 'situaciones',
  },
  {
    name: 'diaInicioRevista3',
    label: 'Día inicio revista 3',
    kind: 'integer',
  },
  {
    name: 'diasTrabajados',
    label: 'Días trabajados',
    kind: 'integer',
  },
  {
    name: 'horaaTrabajadas',
    label: 'Horas trabajadas',
    kind: 'integer',
  },
  {
    name: 'porcentajeAporteAdicionalSS',
    label: 'Aporte adicional SS (%)',
    kind: 'decimal',
  },
  {
    name: 'contribucionTareaDiferencial',
    label: 'Contribución tarea diferencial',
    kind: 'decimal',
  },
  {
    name: 'codigoObraSocial',
    label: 'Código obra social',
    kind: 'text',
  },
  {
    name: 'cantidadAdherentes',
    label: 'Cantidad de adherentes',
    kind: 'integer',
  },
  {
    name: 'aporteAdicionalOS',
    label: 'Aporte Adicional OS',
    kind: 'decimal',
  },
  {
    name: 'contribucionAdicionalOS',
    label: 'Contribución adicional OS',
    kind: 'decimal',
  },
  {
    name: 'bcDiferencialAporteOSyFSR',
    label: 'Base diferencial aporte OS/FSR',
    kind: 'decimal',
  },
  {
    name: 'bcDiferencialOSyFSR',
    label: 'Base diferencial OS/FSR',
    kind: 'decimal',
  },
  {
    name: 'bcDiferencialLRT',
    label: 'Base diferencial LRT',
    kind: 'decimal',
  },
  {
    name: 'remuneracionMaternidadAnses',
    label: 'Remuneración maternidad ANSES',
    kind: 'decimal',
  },
  {
    name: 'remuneracionBruta',
    label: 'Remuneración bruta',
    kind: 'decimal',
  },
  {
    name: 'baseImponible1',
    label: 'Base Imponible 1',
    kind: 'decimal',
  },
  {
    name: 'baseImponible2',
    label: 'Base Imponible 2',
    kind: 'decimal',
  },
  {
    name: 'baseImponible3',
    label: 'Base Imponible 3',
    kind: 'decimal',
  },
  {
    name: 'baseImponible4',
    label: 'Base Imponible 4',
    kind: 'decimal',
  },
  {
    name: 'baseImponible5',
    label: 'Base Imponible 5',
    kind: 'decimal',
  },
  {
    name: 'baseImponible6',
    label: 'Base Imponible 6',
    kind: 'decimal',
  },
  {
    name: 'baseImponible7',
    label: 'Base Imponible 7',
    kind: 'decimal',
  },
  {
    name: 'baseImponible8',
    label: 'Base Imponible 8',
    kind: 'decimal',
  },
  {
    name: 'baseImponible9',
    label: 'Base Imponible 9',
    kind: 'decimal',
  },
  {
    name: 'bcDiferencialAporteSegSocial',
    label: 'Base diferencial aporte SS',
    kind: 'decimal',
  },
  {
    name: 'bcDiferencialContribSegSocial',
    label: 'Base diferencial contribución SS',
    kind: 'decimal',
  },
  {
    name: 'baseImponible10',
    label: 'Base Imponible 10',
    kind: 'decimal',
  },
  {
    name: 'importeADetraer',
    label: 'Importe a detraer',
    kind: 'decimal',
  },
];
