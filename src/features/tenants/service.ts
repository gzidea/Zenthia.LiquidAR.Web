import { z } from 'zod';
import { ApiClient } from '@/services/http/ApiClient';
import { ApiError } from '@/services/http/ApiError';
import { config } from '@/lib/config';
import { sessionHttpHooks } from '@/features/auth/services/authService';
import { getAccessToken } from '@/features/auth/services/sessionTokens';

const activeTenants = z.array(
  z.object({ id: z.number().int().positive(), name: z.string().min(1) }),
);
const api = new ApiClient(config.liquidarBaseURL, {
  ...sessionHttpHooks,
  getAccessToken,
});
export async function listActiveTenants(signal?: AbortSignal) {
  const data = await api.request<unknown>(
    'GET',
    '/contexto/tenants',
    undefined,
    {
      authenticated: true,
      tenantScoped: false,
      signal,
    },
  );
  const result = activeTenants.safeParse(data);
  if (!result.success)
    throw new ApiError(
      'contract',
      'No se pudo validar el listado de tenants activos.',
    );
  return result.data;
}
