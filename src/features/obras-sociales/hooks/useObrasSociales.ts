import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { obraSocialService } from '../services/obraSocialService';
import type { ObraSocialWrite } from '../types/obraSocial';
export function useObrasSociales(
  page: number,
  pageSize: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['obras-sociales', 'list', page, pageSize],
    queryFn: ({ signal }) => obraSocialService.list(page, pageSize, signal),
    enabled,
  });
}
export function useObraSocialDetail(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['obras-sociales', 'detail', id],
    queryFn: ({ signal }) => obraSocialService.detail(id!, signal),
    enabled: enabled && id !== null,
    // Reload when opening; do not replace a draft on focus/reconnection.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useObraSocialProvincias(enabled: boolean) {
  return useQuery({
    queryKey: ['obras-sociales', 'provincias'],
    queryFn: ({ signal }) => obraSocialService.provincias(signal),
    enabled,
  });
}
export function useObraSocialMutations() {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['obras-sociales', 'list'] });
  const save = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: ObraSocialWrite }) =>
      id === null
        ? obraSocialService.create(data)
        : obraSocialService.update(id, data),
    onSuccess: async (value) => {
      client.setQueryData(['obras-sociales', 'detail', value.id], value);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => obraSocialService.delete(id),
    onSuccess: refresh,
  });
  return { save, remove };
}
