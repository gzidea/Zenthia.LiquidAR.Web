import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { convenioService } from '../services/convenioService';
import type { ConvenioWrite, ImportesRequest } from '../types/convenio';
export function useConvenios(page: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: ['convenios', 'list', page, pageSize],
    queryFn: ({ signal }) => convenioService.list(page, pageSize, signal),
    enabled,
  });
}
export function useConvenioDetail(
  id: number | null,
  enabled = true,
  periodo?: string,
) {
  return useQuery({
    queryKey: ['convenios', 'detail', id, periodo ?? 'operativo'],
    queryFn: ({ signal }) => convenioService.detail(id!, periodo, signal),
    enabled: enabled && id !== null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useConvenioMutations() {
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: ConvenioWrite }) =>
      convenioService.save(id, data),
    onSuccess: async (value) => {
      client.setQueryData(
        ['convenios', 'detail', value.convenio.id, 'operativo'],
        value,
      );
      await client.invalidateQueries({ queryKey: ['convenios', 'list'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => convenioService.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['convenios'] }),
  });
  return { save, remove };
}
export function useEscalasMutations(id: number) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ['convenios'] });
  const preview = useMutation({
    mutationFn: (data: ImportesRequest) =>
      convenioService.importes(id, data, false),
  });
  const publish = useMutation({
    mutationFn: (data: ImportesRequest) =>
      convenioService.importes(id, data, true),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: (data: {
      categoria: number;
      version: number;
      revision: number;
      motivo: string;
      dependencias: boolean;
    }) =>
      convenioService.anular(
        data.categoria,
        data.version,
        data.revision,
        data.motivo,
        data.dependencias,
      ),
    onSuccess: refresh,
  });
  return { preview, publish, cancel };
}
export function useHistorial(id: number, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['convenios', 'historial', id, page, pageSize],
    queryFn: ({ signal }) =>
      convenioService.historial(id, page, pageSize, signal),
    refetchOnWindowFocus: false,
  });
}
