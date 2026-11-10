import { beforeEach, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePermissions } from './usePermissions';
import { apiClient } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import { loginSessionSchema } from '../schemas/authSchemas';
import { loginResponse } from '@/test/fixtures';
beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().accept(loginSessionSchema.parse(loginResponse()));
});
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  );
}
it('consulta el perfil real y distingue permisos exactos', async () => {
  vi.spyOn(apiClient, 'request').mockResolvedValue({
    actor: {
      userId: 7,
      applicationId: 42,
      tenantId: 2,
      isSuperAdmin: false,
      permissions: ['sindicatos:read'],
    },
  });
  const { result } = renderHook(usePermissions, { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.can('sindicatos:read')).toBe(true);
  expect(result.current.can('sindicatos:write')).toBe(false);
  expect(result.current.can('liquidar.sindicatos:read')).toBe(false);
});
it('no concede acceso ante perfil de otro usuario ni contrato inválido', async () => {
  vi.spyOn(apiClient, 'request').mockResolvedValue({
    actor: {
      userId: 99,
      applicationId: 42,
      tenantId: 2,
      isSuperAdmin: true,
      permissions: [],
    },
  });
  const { result } = renderHook(usePermissions, { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.can('sindicatos:read')).toBe(false);
});
it('no consulta permisos ni restaura sesión si el usuario es anónimo', () => {
  useAuthStore.getState().clear('logout');
  const request = vi.spyOn(apiClient, 'request');
  renderHook(usePermissions, { wrapper });
  expect(request).not.toHaveBeenCalled();
});
