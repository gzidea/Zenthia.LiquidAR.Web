import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { segurosService, type SegurosKind } from './service';

export function useSeguros(kind: SegurosKind, id?: number, enabled = true) {
  const client = useQueryClient();
  const queryKey = ['seguros', kind, id];
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: ({ signal }) => segurosService.list(kind, id, signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: (body: unknown) => segurosService.publish(kind, id, body),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  return { query, mutation };
}
