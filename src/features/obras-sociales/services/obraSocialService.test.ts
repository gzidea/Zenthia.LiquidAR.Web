import { it, expect } from 'vitest';
import { AxiosHeaders } from 'axios';
import { ApiClient } from '@/services/http/ApiClient';
import { ObraSocialService } from './obraSocialService';
import { initialFields, toWrite } from '../schemas/obraSocialSchema';
it('consume rutas reales, paginación, Bearer y payloads sin identidad en el body', async () => {
  const calls: {
    method?: string;
    url?: string;
    params: unknown;
    data: unknown;
  }[] = [];
  const api = new ApiClient(
    '/api',
    {
      revision: () => 0,
      expire: () => {},
      getAccessToken: () => 'test-only-token',
    },
    async (config) => {
      expect(config.withCredentials).toBe(false);
      expect(config.headers.get('Authorization')).toBe(
        'Bearer test-only-token',
      );
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
  const service = new ObraSocialService(api);
  await service.list(1, 25);
  await service.detail(7);
  await service.provincias();
  await service.create(toWrite(initialFields()));
  await service.update(7, toWrite(initialFields()));
  await service.delete(7);
  expect(calls.map((c) => [c.method, c.url])).toEqual([
    ['get', '/obras-sociales'],
    ['get', '/obras-sociales/7'],
    ['get', '/obras-sociales/provincias'],
    ['post', '/obras-sociales'],
    ['put', '/obras-sociales/7'],
    ['delete', '/obras-sociales/7'],
  ]);
  expect(calls[0]?.params).toEqual({ page: 1, pageSize: 25 });
  const payload = JSON.parse(String(calls[3]?.data));
  expect(Object.keys(payload)).toHaveLength(12);
  for (const field of [
    'id',
    'localidad',
    'provinciaNombre',
    'tenantId',
    'applicationId',
  ])
    expect(payload).not.toHaveProperty(field);
});
