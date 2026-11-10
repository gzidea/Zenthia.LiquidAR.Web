import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { ConvenioService, parseConvenioError } from './convenioService';
describe('Convenios service', () => {
  it('uses the complete and batch routes with authenticated requests', async () => {
    const api = new ApiClient('/api', {
      revision: () => 0,
      expire: () => undefined,
    });
    const request = vi.spyOn(api, 'request').mockResolvedValue({});
    const service = new ConvenioService(api);
    const data = {
      convenio: { codigo: null, nombre: 'Convenio', descripcion: null },
      categorias: [],
      categoriasEliminar: [],
    };
    await service.save(null, data);
    expect(request).toHaveBeenLastCalledWith(
      'POST',
      '/convenios/completo',
      data,
      expect.objectContaining({ authenticated: true }),
    );
    await service.save(7, data);
    expect(request).toHaveBeenLastCalledWith(
      'PUT',
      '/convenios/7/completo',
      data,
      expect.anything(),
    );
    await service.importes(7, { categorias: [] }, false);
    expect(request).toHaveBeenLastCalledWith(
      'POST',
      '/convenios/7/importes/previsualizar',
      { categorias: [] },
      expect.anything(),
    );
  });
  it('only exposes known business messages and never technical server errors', () => {
    const original = new ApiError('conflict', 'Conflicto', 409);
    expect(
      parseConvenioError(original, {
        detail:
          'Categoría 7: La revisión cambió. Consulte el historial y vuelva a previsualizar.',
      }).message,
    ).toContain('Categoría 7');
    expect(
      parseConvenioError(original, {
        detail: 'SQL password connection details',
      }),
    ).toBe(original);
    const server = new ApiError('server', 'Error', 500);
    expect(
      parseConvenioError(server, { detail: 'Convenio no encontrado.' }),
    ).toBe(server);
  });
});
