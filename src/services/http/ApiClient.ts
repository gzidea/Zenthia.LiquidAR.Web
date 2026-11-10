import axios, {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosInstance,
} from 'axios';
import { ApiError, type ApiErrorKind } from './ApiError';

interface SessionHooks {
  revision: () => number;
  expire: () => void;
  getAccessToken?: () => string | null;
  credentials?: () => string | null;
  canRequest?: () => boolean;
  dataTenant?: () => number | null;
  dataRevision?: () => number;
}
interface RequestOptions {
  // Only public clock metadata; never expose cookies or token headers to consumers.
  onServerDate?: (date: string | null) => void;
  onFileName?: (name: string) => void;
  responseType?: 'json' | 'blob';
  authenticated?: boolean;
  params?: Record<string, string | number>;
  signal?: AbortSignal;
  timeoutMs?: number;
  tenantScoped?: boolean;
  // Opt-in endpoint parser: only validated business details leave the service.
  parseError?: (error: ApiError, body: unknown) => ApiError;
}

function normalizeError(error: unknown): ApiError {
  if (axios.isCancel(error))
    return new ApiError('cancelled', 'La solicitud fue cancelada.');
  if (!axios.isAxiosError(error) || !error.response)
    return new ApiError(
      'network',
      'No pudimos conectar con el servidor. Probá de nuevo.',
    );
  const status = error.response.status;
  const messages: Record<number, [ApiErrorKind, string]> = {
    400: ['validation', 'Revisá los datos ingresados.'],
    401: [
      'authentication',
      'No pudimos validar el acceso. Iniciá sesión nuevamente.',
    ],
    403: ['authorization', 'No tenés autorización para realizar esta acción.'],
    404: ['not-found', 'No encontramos el recurso solicitado.'],
    409: ['conflict', 'La operación entró en conflicto. Probá de nuevo.'],
    422: ['validation', 'Revisá los datos ingresados.'],
    429: [
      'server',
      'Hubo demasiados intentos. Esperá un momento y probá de nuevo.',
    ],
  };
  const [kind, fallback] = messages[status] ?? [
    'server',
    'El servicio no está disponible. Probá de nuevo más tarde.',
  ];
  // Only reviewed business messages may cross the HTTP boundary into the UI.
  const allowed = new Set([
    'Credenciales inválidas.',
    'Usuario inactivo.',
    'Sindicato no encontrado.',
    'Banco no encontrado.',
    'No se pudo guardar el banco por un conflicto de datos o relaciones existentes.',
    'No se pudo eliminar el banco por un conflicto de datos o relaciones existentes.',
    'La actualización desde BCRA tuvo errores; los registros incorporados permanecen guardados.',
    'Obra social no encontrada.',
    'No se pudo guardar la obra social por un conflicto de datos o relaciones existentes.',
    'No se pudo eliminar la obra social por un conflicto de datos o relaciones existentes.',
    'No se pudo guardar el sindicato por un conflicto de datos o relaciones existentes.',
    'No se pudo eliminar el sindicato por un conflicto de datos o relaciones existentes.',
    'Contraseña actual incorrecta.',
    'La nueva contraseña y su confirmación no coinciden.',
  ]);
  const body: unknown = error.response.data;
  let detail: unknown;
  if (body && typeof body === 'object') {
    detail =
      'detail' in body
        ? body.detail
        : 'error' in body
          ? body.error
          : 'title' in body
            ? body.title
            : undefined;
  }
  const fieldErrors: Record<string, string> = {};
  if (
    kind === 'validation' &&
    body &&
    typeof body === 'object' &&
    'errors' in body &&
    body.errors &&
    typeof body.errors === 'object'
  ) {
    for (const field of Object.keys(body.errors))
      fieldErrors[field] = 'Revisá el valor ingresado.';
  }
  return new ApiError(
    kind,
    status < 500 && typeof detail === 'string' && allowed.has(detail)
      ? detail
      : fallback,
    status,
    fieldErrors,
  );
}

export class ApiClient {
  private readonly http: AxiosInstance;
  constructor(
    baseURL: string,
    private readonly session: SessionHooks,
    adapter?: AxiosAdapter,
  ) {
    this.http = axios.create({
      baseURL,
      withCredentials: !session.getAccessToken,
      timeout: 15000,
      headers: { Accept: 'application/json' },
      adapter,
    });
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const revision = this.session.revision();
    // Only bearer clients talk to LiquidAR. Security cookies never receive this filter.
    const scoped =
      Boolean(this.session.getAccessToken) && options.tenantScoped !== false;
    const dataRevision = scoped ? this.session.dataRevision?.() : undefined;
    const tenant = scoped ? this.session.dataTenant?.() : null;
    const credentials = this.session.credentials?.();
    const isCurrent = () =>
      revision === this.session.revision() &&
      credentials === this.session.credentials?.() &&
      (!scoped || dataRevision === this.session.dataRevision?.());
    try {
      if (options.authenticated && this.session.canRequest?.() === false)
        throw new ApiError(
          'authentication',
          'Tu sesión venció. Retomala para continuar.',
          401,
        );
      let authorization: string | undefined;
      if (options.authenticated && this.session.getAccessToken) {
        if (
          !path.startsWith('/') ||
          path.startsWith('//') ||
          path.includes('\\')
        )
          throw new ApiError('contract', 'La ruta de la API no es válida.');
        const token = this.session.getAccessToken();
        if (!token)
          throw new ApiError(
            'authentication',
            'Iniciá sesión nuevamente para acceder a LiquidAR.',
            401,
          );
        authorization = 'Bearer ' + token;
      }
      const response = await this.http.request<T>({
        method,
        url: path,
        data,
        params: options.params,
        responseType: options.responseType,
        signal: options.signal,
        timeout: options.timeoutMs,
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          ...(options.authenticated && tenant != null
            ? { 'X-LiquidAR-Tenant-Id': String(tenant) }
            : {}),
        },
      });
      if (options.authenticated && !isCurrent())
        throw new ApiError('cancelled', 'La sesión cambió.');
      if (options.onServerDate) {
        const date =
          response.headers instanceof AxiosHeaders
            ? response.headers.get('date')
            : response.headers['date'];
        const age =
          response.headers instanceof AxiosHeaders
            ? response.headers.get('age')
            : response.headers['age'];
        const ageSeconds = age == null ? 0 : Number(age);
        options.onServerDate(
          typeof date === 'string' && ageSeconds === 0 ? date : null,
        );
      }
      const disposition = response.headers['content-disposition'];
      if (options.onFileName && typeof disposition === 'string') {
        const match =
          /\bfilename=(?:"([a-z0-9_-]{1,240}\.(?:pdf|zip|txt))"|([a-z0-9_-]{1,240}\.(?:pdf|zip|txt)))(?:;|$)/i.exec(
            disposition,
          );
        const name = match?.[1] ?? match?.[2];
        if (name) options.onFileName(name);
      }
      return response.data;
    } catch (cause) {
      if (options.authenticated && !isCurrent())
        throw new ApiError('cancelled', 'La sesión cambió.');
      if (axios.isAxiosError(cause) && cause.response?.data instanceof Blob) {
        try {
          cause.response.data = JSON.parse(await cause.response.data.text());
        } catch {
          // Non-JSON download errors retain the safe HTTP fallback.
        }
      }
      if (options.authenticated && !isCurrent())
        throw new ApiError('cancelled', 'La sesión cambió.');
      let error = cause instanceof ApiError ? cause : normalizeError(cause);
      if (options.parseError && axios.isAxiosError(cause) && cause.response)
        error = options.parseError(error, cause.response.data);
      if (
        options.authenticated &&
        error instanceof ApiError &&
        error.status === 401 &&
        isCurrent()
      ) {
        this.session.expire();
      }
      throw error;
    }
  }
}
