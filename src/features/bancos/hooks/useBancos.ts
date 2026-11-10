import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bancoService } from '../services/bancoService';
import type { BancoWrite } from '../types/banco';
export function useBancos(page: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: ['bancos', 'list', page, pageSize],
    queryFn: ({ signal }) => bancoService.list(page, pageSize, signal),
    enabled,
  });
}
export function useBancoDetail(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['bancos', 'detail', id],
    queryFn: ({ signal }) => bancoService.detail(id!, signal),
    enabled: enabled && id !== null,
    // Reload when opening; do not replace a draft on focus/reconnection.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useBancoMutations() {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['bancos', 'list'] });
  const save = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: BancoWrite }) =>
      id === null ? bancoService.create(data) : bancoService.update(id, data),
    onSuccess: async (value) => {
      client.setQueryData(['bancos', 'detail', value.id], value);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => bancoService.delete(id),
    onSuccess: refresh,
  });
  return { save, remove };
}

export function useBcraImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => bancoService.actualizarDesdeBcra(),
    retry: false,
    onSettled: () => client.invalidateQueries({ queryKey: ['bancos', 'list'] }),
  });
}
