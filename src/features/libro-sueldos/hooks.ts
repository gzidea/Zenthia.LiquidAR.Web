import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { libroService } from './service';
import type { Libro } from './types';

export function useLibros(
  page: number,
  pageSize: number,
  empresa: number | undefined,
  periodo: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['libro-sueldos', 'list', page, pageSize, empresa, periodo],
    queryFn: ({ signal }) =>
      libroService.list(page, pageSize, empresa, periodo, signal),
    enabled,
  });
}
export function useLibro(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['libro-sueldos', 'detail', id],
    queryFn: ({ signal }) => libroService.detail(id!, signal),
    enabled: enabled && id !== null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useLsdReferencias(
  empresa: number | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['libro-sueldos', 'referencias', empresa],
    queryFn: ({ signal }) => libroService.referencias(empresa, signal),
    enabled,
    refetchOnWindowFocus: false,
  });
}
export function useLsdSave() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (value: Libro) => libroService.save(value),
    onSuccess: async (value) => {
      client.setQueryData(
        ['libro-sueldos', 'detail', value.cabecera.id],
        value,
      );
      await client.invalidateQueries({ queryKey: ['libro-sueldos', 'list'] });
    },
  });
}
