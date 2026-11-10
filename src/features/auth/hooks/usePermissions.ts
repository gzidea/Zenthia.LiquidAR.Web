import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import { ApiError } from '@/services/http/ApiError';
import { canRequestWithSession } from '../services/sessionExpiry';
import { useTenantContextStore } from '@/stores/tenantContextStore';
const profileSchema = z.object({
  user: z
    .object({
      firstName: z.string().nullable().optional(),
      lastName: z.string().nullable().optional(),
    })
    .optional(),
  actor: z.object({
    userId: z.number().int(),
    applicationId: z.number().int(),
    tenantId: z.number().int(),
    isSuperAdmin: z.boolean(),
    permissions: z.array(z.string()),
  }),
});
export function usePermissions() {
  const selectedTenant = useTenantContextStore((s) => s.tenant?.id);
  const session = useAuthStore((state) => state.session);
  const revision = useAuthStore((state) => state.revision);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['permissions', revision],
    enabled: session.status === 'authenticated',
    staleTime: 60000,
    queryFn: async ({ signal }) => {
      // Keep the mounted editor while its session is paused. No protected HTTP
      // request is allowed until the user resumes with fresh credentials.
      const cached = client.getQueryData<
        z.infer<typeof profileSchema>['actor'] & { displayName?: string }
      >(['permissions', revision]);
      if (!canRequestWithSession() && cached) return cached;
      const value = await apiClient.request<unknown>(
        'GET',
        '/users/me',
        undefined,
        { authenticated: true, signal },
      );
      const parsed = profileSchema.safeParse(value);
      if (
        !parsed.success ||
        !('user' in session) ||
        parsed.data.actor.userId !== session.user.userId
      )
        throw new ApiError(
          'contract',
          'No pudimos validar los permisos de la sesión.',
        );
      return {
        ...parsed.data.actor,
        displayName: [parsed.data.user?.firstName, parsed.data.user?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim(),
      };
    },
  });
  const pausedError = Boolean(
    query.data &&
    query.error instanceof ApiError &&
    (query.error.kind === 'authentication' || query.error.kind === 'cancelled'),
  );
  const isError = query.isError && !pausedError;
  return {
    ...query,
    data: query.data
      ? { ...query.data, tenantId: selectedTenant ?? query.data.tenantId }
      : undefined,
    isError,
    can: (permission: string) =>
      Boolean(
        !isError &&
        query.data &&
        (query.data.isSuperAdmin ||
          query.data.permissions.includes(permission)),
      ),
  };
}
