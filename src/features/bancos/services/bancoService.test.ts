import { expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { ApiClient } from '@/services/http/ApiClient';
import { BancoService } from './bancoService';
import { BcraImportError } from './bcraResult';

const session = () => ({
  revision: () => 0,
  expire: vi.fn(),
  getAccessToken: () => 'test-only-token',
});
const result = {
  incorporados: 1,
  omitidos: 2,
  fallidos: [{ codigoEntidad: 33, motivo: 'No se pudo incorporar el banco.' }],
};

it('consume las rutas reales con Bearer, paginación, señal y timeout específico BCRA', async () => {
  const calls: {
    method?: string;
    url?: string;
    params: unknown;
    data: unknown;
  }[] = [];
  const abort = new AbortController();
  const api = new ApiClient('/api', session(), async (config) => {
    expect(config.headers.get('Authorization')).toBe('Bearer test-only-token');
    expect(config.withCredentials).toBe(false);
    expect(config.timeout).toBe(config.url?.endsWith('bcra') ? 120000 : 15000);
    if (config.method === 'get') expect(config.signal).toBe(abort.signal);
    calls.push({
      method: config.method,
      url: config.url,
      params: config.params,
      data: config.data,
    });
    return {
      config,
      data: { ...result, fallidos: [] },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
    };
  });
  const service = new BancoService(api);
  await service.list(2, 25, abort.signal);
  await service.detail(7, abort.signal);
  const data = { codigoEntidad: 0, denominacion: null, abreviacion: '' };
  await service.create(data);
  await service.update(7, data);
  await service.delete(7);
  await service.actualizarDesdeBcra();
  expect(calls.map((c) => [c.method, c.url])).toEqual([
    ['get', '/bancos'],
    ['get', '/bancos/7'],
    ['post', '/bancos'],
    ['put', '/bancos/7'],
    ['delete', '/bancos/7'],
    ['post', '/bancos/actualizar-desde-bcra'],
  ]);
  expect(calls[0]?.params).toEqual({ page: 2, pageSize: 25 });
  expect(JSON.parse(String(calls[2]?.data))).toEqual(data);
  expect(calls[5]?.data).toBeUndefined();
});

function failingService(status: number, body: unknown) {
  const hooks = session();
  const adapter: AxiosAdapter = vi.fn(async (config) => {
    throw new AxiosError(
      'internal details',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      {
        config,
        data: body,
        status,
        statusText: 'Error',
        headers: new AxiosHeaders(),
      },
    );
  });
  return {
    service: new BancoService(new ApiClient('/api', hooks, adapter)),
    hooks,
    adapter,
  };
}
it('conserva el resultado parcial del 409 sin exponer motivos desconocidos', async () => {
  const { service, adapter } = failingService(409, {
    resultado: {
      ...result,
      fallidos: [{ codigoEntidad: 33, motivo: 'SQL private password' }],
    },
  });
  await expect(service.actualizarDesdeBcra()).rejects.toBeInstanceOf(
    BcraImportError,
  );
  expect(adapter).toHaveBeenCalledTimes(1);
  await expect(service.actualizarDesdeBcra()).rejects.toMatchObject({ result });
});
it.each([
  [401, 'authentication'],
  [403, 'authorization'],
  [502, 'server'],
])('normaliza %s durante importación sin reintento', async (status, kind) => {
  const { service, adapter, hooks } = failingService(Number(status), {
    title: 'private exception',
  });
  await expect(service.actualizarDesdeBcra()).rejects.toMatchObject({
    status,
    kind,
  });
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(hooks.expire).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
});
it('no inventa un resultado parcial ante un cuerpo inválido', async () => {
  const { service } = failingService(409, {
    resultado: { incorporados: '1', omitidos: 0, fallidos: [] },
  });
  await expect(service.actualizarDesdeBcra()).rejects.not.toHaveProperty(
    'result',
  );
});
it('rechaza una respuesta exitosa incompatible', async () => {
  const api = new ApiClient('/api', session(), async (config) => ({
    config,
    data: { success: true },
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
  }));
  await expect(
    new BancoService(api).actualizarDesdeBcra(),
  ).rejects.toHaveProperty('kind', 'contract');
});
