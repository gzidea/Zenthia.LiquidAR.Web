import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useTenantContextStore } from '@/stores/tenantContextStore';
function SessionQueries({ children }: { children: ReactNode }) {
  const expiresAt = useAuthStore((state) =>
    'user' in state.session ? state.session.user.expiresAt : null,
  );
  const previousExpiry = useRef(expiresAt);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
  );
  useEffect(() => {
    if (
      previousExpiry.current !== expiresAt &&
      previousExpiry.current &&
      expiresAt
    ) {
      // Refresh permissions without remounting forms or refetching their details.
      void client.invalidateQueries({ queryKey: ['permissions'] });
      void client.refetchQueries({
        type: 'active',
        predicate: (query) =>
          query.state.status === 'error' && query.queryKey[0] !== 'permissions',
      });
    }
    previousExpiry.current = expiresAt;
  }, [client, expiresAt]);
  useEffect(
    () => () => {
      client.clear();
    },
    [client],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export function QueryProvider({ children }: { children: ReactNode }) {
  const revision = useAuthStore((state) => state.revision);
  const tenantRevision = useTenantContextStore((state) => state.revision);
  return (
    <SessionQueries key={`${revision}:${tenantRevision}`}>
      {children}
    </SessionQueries>
  );
}
