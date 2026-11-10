import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { legajoService } from '../services/legajoService';
import type { Write } from '../types/legajo';
export const useLegajos = (
  page: number,
  pageSize: number,
  buscar: string,
  empresa: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: ['legajos', 'list', page, pageSize, buscar, empresa],
    queryFn: ({ signal }) =>
      legajoService.list(page, pageSize, buscar, empresa, signal),
    enabled,
  });
export const useLegajo = (id: number | null) =>
  useQuery({
    queryKey: ['legajos', 'detail', id],
    queryFn: ({ signal }) => legajoService.detail(id!, signal),
    enabled: id !== null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
export const useCatalogo = (
  tipo: string,
  padreId?: number | null,
  enabled = true,
) =>
  useQuery({
    queryKey: ['legajos', 'catalog', tipo, padreId],
    queryFn: ({ signal }) => legajoService.catalog(tipo, padreId, signal),
    enabled,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
export function useLegajoMutations() {
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: Write }) =>
      legajoService.save(id, data),
    onSuccess: async (value) => {
      client.setQueryData(['legajos', 'detail', value.legajo.id], value);
      await client.invalidateQueries({ queryKey: ['legajos', 'list'] });
    },
  });
  const remove = useMutation({
    mutationFn: legajoService.remove,
    onSuccess: () => client.invalidateQueries({ queryKey: ['legajos'] }),
  });
  return { save, remove };
}
