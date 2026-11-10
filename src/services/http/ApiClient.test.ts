import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { deferred } from '@/test/fixtures';
import { ApiClient } from './ApiClient';
import { errorMessage, ApiError } from './ApiError';
it('acepta nombres seguros ZIP, PDF y TXT y rechaza rutas de descarga', async () => {
  for (const name of [
    'recibos.zip',
    '30-20_102026_01.pdf',
    '300000000011020261.txt',
    '../recibos.zip',
  ]) {
    const onFileName = vi.fn();
    const client = new ApiClient(
      '/api',
      { revision: () => 0, expire: vi.fn() },
      async (config) => ({
        data: new Blob(),
        status: 200,
        statusText: 'OK',
        config,
        headers: new AxiosHeaders({
          'content-disposition': `attachment; filename="${name}"`,
        }),
      }),
    );
    await client.request(
      'POST',
      '/recibos/pdf/zip',
      {},
      { responseType: 'blob', onFileName },
    );
    if (name.startsWith('..')) expect(onFileName).not.toHaveBeenCalled();
    else expect(onFileName).toHaveBeenCalledWith(name);
  }
});

it('acepta filename TXT sin comillas como lo emite ASP.NET Core', async () => {
  const onFileName = vi.fn();
  const client = new ApiClient(
    '/api',
    { revision: () => 0, expire: vi.fn() },
    async (config) => ({
      data: new Blob(),
      status: 200,
      statusText: 'OK',
      config,
      headers: new AxiosHeaders({
        'content-disposition':
          "attachment; filename=300000000011020261.txt; filename*=UTF-8''300000000011020261.txt",
      }),
    }),
  );
  await client.request(
    'POST',
    '/libro-sueldos/1/exportar',
    {},
    { responseType: 'blob', onFileName },
  );
  expect(onFileName).toHaveBeenCalledWith('300000000011020261.txt');
});

function failure(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
) {
  return new AxiosError(
    'internal private detail',
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    { data, status, statusText: 'Error', config, headers: new AxiosHeaders() },
  );
}
describe('ApiClient', () => {
  it('decodifica errores JSON de una descarga antes del parser específico', async () => {
    const blob = new Blob();
    Object.defineProperty(blob, 'text', {
      value: async () => JSON.stringify({ detail: 'Mensaje revisado' }),
    });
    const parser = vi.fn((error: ApiError, body: unknown) => {
      expect(body).toEqual({ detail: 'Mensaje revisado' });
      return new ApiError(error.kind, 'Mensaje revisado', error.status);
    });
    const client = new ApiClient(
      '/api',
      { revision: () => 0, expire: vi.fn() },
      async (config) => {
        throw failure(config, 422, blob);
      },
    );
    await expect(
      client.request('GET', '/recibos/4/pdf', undefined, {
        responseType: 'blob',
        parseError: parser,
      }),
    ).rejects.toHaveProperty('message', 'Mensaje revisado');
    expect(parser).toHaveBeenCalledOnce();
  });
  it('conserva el fallback si la descarga devuelve un cuerpo inválido', async () => {
    const blob = new Blob();
    Object.defineProperty(blob, 'text', {
      value: async () => '<html>Error</html>',
    });
    const client = new ApiClient(
      '/api',
      { revision: () => 0, expire: vi.fn() },
      async (config) => {
        throw failure(config, 422, blob);
      },
    );
    await expect(
      client.request('GET', '/recibos/4/pdf', undefined, {
        responseType: 'blob',
      }),
    ).rejects.toHaveProperty('message', 'Revisá los datos ingresados.');
  });
  it.each([
    [404, 'Obra social no encontrada.'],
    [
      409,
      'No se pudo guardar la obra social por un conflicto de datos o relaciones existentes.',
    ],
    [
      409,
      'No se pudo eliminar la obra social por un conflicto de datos o relaciones existentes.',
    ],
  ])(
    'conserva el mensaje revisado de Obras Sociales (%s)',
    async (status, message) => {
      const client = new ApiClient(
        '/api',
        { revision: () => 0, expire: vi.fn() },
        async (config) => {
          throw failure(config, status, { error: message });
        },
      );
      await expect(
        client.request('PUT', '/obras-sociales/7'),
      ).rejects.toHaveProperty('message', message);
    },
  );
  it('centraliza URL, credenciales y headers sin Authorization ni tokens propios', async () => {
    const adapter: AxiosAdapter = vi.fn(async (config) => {
      expect(config.baseURL).toBe('/api');
      expect(config.url).toBe('/auth/login');
      expect(config.method).toBe('post');
      expect(config.withCredentials).toBe(true);
      expect(config.timeout).toBe(15000);
      expect(config.headers.get('Accept')).toBe('application/json');
      expect(config.headers.has('Authorization')).toBe(false);
      expect(config.headers.has('Cookie')).toBe(false);
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      };
    });
    const client = new ApiClient(
      '/api',
      { revision: () => 1, expire: vi.fn() },
      adapter,
    );
    expect(
      await client.request('POST', '/auth/login', { userName: 'ana' }),
    ).toEqual({ ok: true });
  });
  it.each([
    [400, 'validation'],
    [401, 'authentication'],
    [403, 'authorization'],
    [404, 'not-found'],
    [409, 'conflict'],
    [422, 'validation'],
    [429, 'server'],
    [500, 'server'],
    [503, 'server'],
  ])('normaliza %s, no expone detalles internos', async (status, kind) => {
    const expire = vi.fn();
    const client = new ApiClient(
      '/api',
      { revision: () => 0, expire },
      async (config) => {
        throw failure(config, status as number, {
          detail: 'Password=secret; private stack trace',
        });
      },
    );
    await expect(
      client.request('PUT', '/users/', {}, { authenticated: true }),
    ).rejects.toMatchObject({ kind, status });
    expect(expire).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    await expect(
      client.request('POST', '/auth/login'),
    ).rejects.not.toHaveProperty(
      'message',
      'Password=secret; private stack trace',
    );
  });
  it.each(['detail', 'error'])(
    'conserva un mensaje de negocio revisado en %s',
    async (key) => {
      const client = new ApiClient(
        '/api',
        { revision: () => 0, expire: vi.fn() },
        async (config) => {
          throw failure(config, 403, {
            [key]: 'Contraseña actual incorrecta.',
          });
        },
      );
      await expect(client.request('PUT', '/users/')).rejects.toHaveProperty(
        'message',
        'Contraseña actual incorrecta.',
      );
    },
  );
  it('no invalida la sesión ante un 401 de login ni repite solicitudes', async () => {
    const expire = vi.fn();
    const adapter: AxiosAdapter = vi.fn(async (config) => {
      throw failure(config, 401, null);
    });
    const client = new ApiClient(
      '/api',
      { revision: () => 0, expire },
      adapter,
    );
    await expect(client.request('POST', '/auth/login')).rejects.toHaveProperty(
      'kind',
      'authentication',
    );
    expect(expire).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(1);
  });
  it('un 401 atrasado no invalida una sesión nueva', async () => {
    let revision = 1;
    const pending = deferred<void>();
    const expire = vi.fn();
    const client = new ApiClient(
      '/api',
      { revision: () => revision, expire },
      async (config) => {
        await pending.promise;
        throw failure(config, 401, {});
      },
    );
    const request = client.request(
      'PUT',
      '/users/',
      {},
      { authenticated: true },
    );
    revision = 2;
    pending.resolve();
    await expect(request).rejects.toHaveProperty('kind', 'cancelled');
    expect(expire).not.toHaveBeenCalled();
  });
  it('normaliza fallas de red y mensajes desconocidos', async () => {
    const client = new ApiClient(
      '/api',
      { revision: () => 0, expire: vi.fn() },
      async () => {
        throw new Error('private error');
      },
    );
    await expect(client.request('POST', '/auth/login')).rejects.toMatchObject({
      kind: 'network',
      message: 'No pudimos conectar con el servidor. Probá de nuevo.',
    });
    expect(errorMessage(new Error('secret'))).not.toContain('secret');
    expect(errorMessage(new ApiError('network', 'Mensaje seguro'))).toBe(
      'Mensaje seguro',
    );
  });
  it('normaliza cancelación sin invalidar sesión', async () => {
    const expire = vi.fn();
    const client = new ApiClient(
      '/api',
      { revision: () => 0, expire },
      async () => {
        throw { __CANCEL__: true };
      },
    );
    await expect(client.request('POST', '/auth/login')).rejects.toHaveProperty(
      'kind',
      'cancelled',
    );
    expect(expire).not.toHaveBeenCalled();
  });
});
