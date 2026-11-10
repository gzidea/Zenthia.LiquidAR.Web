import { z } from 'zod';
import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { getAccessToken } from '@/features/auth/services/sessionTokens';
import { sessionHttpHooks } from '@/features/auth/services/authService';
import { fields01, fields02, fields03, fields04 } from './fields';
import type {
  Asignacion,
  Cobertura,
  Concepto,
  Configuracion,
  Libro,
  Pagina,
  Referencias,
} from './types';

const validation = z.object({
  errors: z.record(
    z.string().regex(/^[a-zA-Z0-9.\[\]]+$/),
    z.array(z.string().max(2000)),
  ),
});
const errorLabels: Record<string, string> = {
  ...Object.fromEntries(
    [...fields01, ...fields02, ...fields03, ...fields04].map((f) => [
      f.name,
      f.label,
    ]),
  ),
  archivo: 'Archivo',
  cabecera: 'Cabecera',
  configuracion: 'Configuración',
  recibos: 'Recibos',
  legajos: 'Legajos',
  formulas: 'Fórmulas',
  scvo: 'Seguro colectivo de vida obligatorio',
  codigoEmpleador: 'Código del empleador',
  descripcion: 'Descripción',
  codigoArca: 'Clasificación ARCA',
  idConceptoEmpresa: 'Concepto del empleador',
  idFormula: 'Fórmula',
  periodoDesde: 'Vigencia desde',
  periodoHasta: 'Vigencia hasta',
  idBanco: 'Banco',
  fechaPago: 'Fecha de pago',
  generado: 'Generación',
  exportado: 'Exportación',
  registros02: 'Registros 02',
  registros03: 'Registros 03',
  registros04: 'Registros 04',
  page: 'Paginación',
  empresas: 'Empresa',
  envios: 'Envío',
  tipos: 'Tipo de liquidación',
  tipoEmpresa: 'Tipo de empleador',
  situaciones: 'Situación de revista',
  condiciones: 'Condición',
  actividades: 'Actividad',
  modalidades: 'Modalidad de contratación',
  siniestros: 'Siniestrado',
  localidades: 'Localidad',
  formaPago: 'Forma de pago',
  cbu: 'CBU',
  legajo: 'Legajo',
  diaInicioRevista: 'Día inicio de revista',
};
export function parseLsdError(error: ApiError, body: unknown) {
  if (error.status === 409)
    return new ApiError(
      'conflict',
      'El registro cambió o tiene datos dependientes. Volvé a consultar antes de continuar.',
      409,
    );
  const parsed = validation.safeParse(body);
  if (error.status !== 400 || !parsed.success) return error;
  const fields = Object.fromEntries(
    Object.entries(parsed.data.errors).map(([key, messages]) => [
      key.charAt(0).toLowerCase() + key.slice(1),
      messages.join('\n'),
    ]),
  );
  if (Object.keys(fields).some((key) => !(key in errorLabels))) return error;
  return new ApiError(
    'validation',
    Object.entries(fields)
      .map(([key, message]) => `${errorLabels[key]}: ${message}`)
      .join(' '),
    400,
    fields,
  );
}
const api = new ApiClient(config.liquidarBaseURL, {
  ...sessionHttpHooks,
  getAccessToken,
});
export function parseLsdExportError(error: ApiError, body: unknown) {
  const parsed = parseLsdError(error, body);
  if (parsed.status !== 400 || !Object.keys(parsed.fieldErrors).length)
    return parsed;
  const location = (key: string): string => {
    if (key === 'tipoEmpresa' || key === 'idTipoEmpresaAfip')
      return 'Revisá Libro de sueldo → Editar → Registros 04 → Tipo de empleador. Para futuras generaciones, completá Empresas → Editar → Tipo de empresa AFIP.';
    if (key === 'idEmpresa' || key === 'empresas')
      return 'Revisá Empresas → Editar → Clave única (CUIT) y la empresa seleccionada en Libro de sueldo → Editar.';
    if (['formaPago', 'formasPago', 'cbu', 'legajo'].includes(key))
      return 'Completá el dato del trabajador en Legajos → Editar. Luego volvé a exportar el TXT.';
    if (key === 'generado') return 'Usá la acción Generar de Libro de sueldo.';
    if (['registros02', 'registros03', 'registros04'].includes(key))
      return 'Revisá Libro de sueldo → Editar → Registros 02, 03 y 04.';
    for (const [number, fields] of [
      ['04', fields04],
      ['03', fields03],
      ['02', fields02],
    ] as const) {
      const field = fields.find((f) => f.name === key || f.lookup === key);
      if (field)
        return `Revisá Libro de sueldo → Editar → Registros ${number} → ${field.label}.`;
    }
    const header = fields01.find((f) => f.name === key || f.lookup === key);
    return header
      ? `Revisá Libro de sueldo → Editar → ${header.label}.`
      : 'Revisá Libro de sueldo → Editar y los datos del trabajador en Legajos → Editar.';
  };
  return new ApiError(
    'validation',
    Object.entries(parsed.fieldErrors)
      .map(
        ([key, message]) => `${errorLabels[key]}: ${message} ${location(key)}`,
      )
      .join(' '),
    400,
    parsed.fieldErrors,
  );
}
const options = {
  authenticated: true,
  timeoutMs: 120000,
  parseError: parseLsdError,
};
export const libroService = {
  eventos: (id: number, signal?: AbortSignal) =>
    api.request<
      {
        id: number;
        userId: number;
        applicationId: number;
        creadoEn: string;
        operacion: string;
        versionOrigen: number;
        versionResultado: number;
        sha256: string | null;
        bytes: number | null;
      }[]
    >('GET', `/libro-sueldos/${id}/eventos`, undefined, { ...options, signal }),
  diagnostico: (id: number, signal?: AbortSignal) =>
    api.request<{
      version: number;
      consultadoEn: string;
      exhaustivo: boolean;
      problemas: {
        etapa: string;
        idRecibo: number | null;
        idLegajo: number | null;
        campo: string;
        mensaje: string;
        accion: string;
      }[];
    }>('GET', `/libro-sueldos/${id}/diagnostico`, undefined, {
      ...options,
      signal,
    }),
  list: (
    page: number,
    pageSize: number,
    empresa?: number,
    periodo?: string,
    signal?: AbortSignal,
  ) =>
    api.request<Pagina>('GET', '/libro-sueldos', undefined, {
      ...options,
      signal,
      params: {
        page,
        pageSize,
        ...(empresa ? { empresaId: empresa } : {}),
        ...(periodo ? { periodo } : {}),
      },
    }),
  detail: (id: number, signal?: AbortSignal) =>
    api.request<Libro>('GET', `/libro-sueldos/${id}`, undefined, {
      ...options,
      signal,
    }),
  referencias: (empresa?: number, signal?: AbortSignal) =>
    api.request<Referencias>('GET', '/libro-sueldos/referencias', undefined, {
      ...options,
      signal,
      params: empresa ? { empresaId: empresa } : {},
    }),
  save: (value: Libro) =>
    api.request<Libro>(
      value.cabecera.id ? 'PUT' : 'POST',
      '/libro-sueldos' + (value.cabecera.id ? '/' + value.cabecera.id : ''),
      value,
      options,
    ),
  remove: (id: number, version: number) =>
    api.request<void>('DELETE', `/libro-sueldos/${id}`, undefined, {
      ...options,
      params: { version },
    }),
  cobertura: (id: number, signal?: AbortSignal) =>
    api.request<Cobertura[]>(
      'GET',
      `/libro-sueldos/${id}/cobertura`,
      undefined,
      { ...options, signal },
    ),
  generar: (id: number, version: number, reemplazar: boolean) =>
    api.request<Libro>(
      'POST',
      `/libro-sueldos/${id}/generar`,
      { version, reemplazar },
      options,
    ),
  pago: (id: number, version: number, idBanco: number, fechaPago: string) =>
    api.request<Libro>(
      'POST',
      `/libro-sueldos/${id}/pago`,
      { version, idBanco, fechaPago },
      options,
    ),
  exportar: async (id: number, version: number) => {
    let nombre = '';
    const blob = await api.request<Blob>(
      'POST',
      `/libro-sueldos/${id}/exportar`,
      { version },
      {
        ...options,
        responseType: 'blob',
        parseError: parseLsdExportError,
        onFileName: (value) => {
          nombre = value;
        },
      },
    );
    if (!nombre.endsWith('.txt'))
      throw new ApiError(
        'contract',
        'No se recibió el nombre del archivo TXT.',
      );
    return { blob, nombre };
  },
  configuracion: (empresa: number, signal?: AbortSignal) =>
    api.request<Configuracion>(
      'GET',
      `/libro-sueldos/empresas/${empresa}/configuracion`,
      undefined,
      { ...options, signal },
    ),
  concepto: (empresa: number, value: Concepto) =>
    api.request<Concepto>(
      value.id ? 'PUT' : 'POST',
      `/libro-sueldos/empresas/${empresa}/conceptos` +
        (value.id ? '/' + value.id : ''),
      value,
      options,
    ),
  asignacion: (empresa: number, value: Asignacion) =>
    api.request<Asignacion>(
      value.id ? 'PUT' : 'POST',
      `/libro-sueldos/empresas/${empresa}/asignaciones` +
        (value.id ? '/' + value.id : ''),
      value,
      options,
    ),
};
