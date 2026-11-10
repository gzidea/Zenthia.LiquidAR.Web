import { it, expect } from 'vitest';
import { AxiosHeaders } from 'axios';
import { ApiClient } from '@/services/http/ApiClient';
import { SindicatoService } from './sindicatoService';
import { initialFields, toWrite } from '../schemas/sindicatoSchema';
it('consume rutas reales, paginación, cookies y payloads sin identidad en el body', async () => {
  const calls: {
    method?: string;
    url?: string;
    params: unknown;
    data: unknown;
  }[] = [];
  const api = new ApiClient(
    '/api',
    { revision: () => 0, expire: () => {} },
    async (config) => {
      expect(config.withCredentials).toBe(true);
      expect(config.headers.has('Authorization')).toBe(false);
      calls.push({
        method: config.method,
        url: config.url,
        params: config.params,
        data: config.data,
      });
      return {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      };
    },
  );
  const service = new SindicatoService(api);
  await service.list(1, 25);
  await service.detail(7);
  await service.provincias();
  await service.create(toWrite(initialFields()));
  await service.update(7, toWrite(initialFields()));
  await service.delete(7);
  expect(calls.map((c) => [c.method, c.url])).toEqual([
    ['get', '/sindicatos'],
    ['get', '/sindicatos/7'],
    ['get', '/provincias'],
    ['post', '/sindicatos'],
    ['put', '/sindicatos/7'],
    ['delete', '/sindicatos/7'],
  ]);
  expect(calls[0]?.params).toEqual({ page: 1, pageSize: 25 });
  expect(JSON.parse(String(calls[3]?.data))).not.toHaveProperty('id');
});
