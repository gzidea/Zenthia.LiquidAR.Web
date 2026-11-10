import { ApiClient } from '@/services/http/ApiClient';
import { config } from '@/lib/config';
import type {
  DemoInicio,
  DemoOpcion,
  DemoRequest,
  DemoResultado,
} from './types';

export class ReciboDemoService {
  constructor(private readonly api: ApiClient) {}
  inicio(signal?: AbortSignal) {
    return this.api.request<DemoInicio>('GET', '/demo/recibo', undefined, {
      signal,
    });
  }
  categorias(id: number, signal?: AbortSignal) {
    return this.api.request<DemoOpcion[]>(
      'GET',
      `/demo/recibo/categorias/${id}`,
      undefined,
      { signal },
    );
  }
  calcular(request: DemoRequest, signal?: AbortSignal) {
    return this.api.request<DemoResultado>(
      'POST',
      '/demo/recibo/calcular',
      request,
      { signal },
    );
  }
}
// No access to the visitor's session or to the dedicated server account.
export const reciboDemoService = new ReciboDemoService(
  new ApiClient(config.liquidarBaseURL, {
    revision: () => 0,
    expire: () => {},
  }),
);
