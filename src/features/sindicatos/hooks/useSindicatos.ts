import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sindicatoService } from '../services/sindicatoService';
import type { SindicatoWrite } from '../types/sindicato';
export function useSindicatos(
  page: number,
  pageSize: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['sindicatos', 'list', page, pageSize],
    queryFn: ({ signal }) => sindicatoService.list(page, pageSize, signal),
    enabled,
  });
}
export function useSindicatoDetail(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['sindicatos', 'detail', id],
    queryFn: ({ signal }) => sindicatoService.detail(id!, signal),
    enabled: enabled && id !== null,
    // Reload when opening; do not replace a draft on focus/reconnection.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useProvincias(enabled: boolean) {
  return useQuery({
    queryKey: ['sindicatos', 'provincias'],
    queryFn: ({ signal }) => sindicatoService.provincias(signal),
    enabled,
  });
}
export function useSindicatoMutations() {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['sindicatos', 'list'] });
  const save = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: SindicatoWrite }) =>
      id === null
        ? sindicatoService.create(data)
        : sindicatoService.update(id, data),
    onSuccess: async (value) => {
      client.setQueryData(['sindicatos', 'detail', value.id], value);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => sindicatoService.delete(id),
    onSuccess: refresh,
  });
  return { save, remove };
}
