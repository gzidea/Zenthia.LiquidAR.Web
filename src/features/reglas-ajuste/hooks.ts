import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reglaService } from './service';
import type { Filtros, ReglaWrite, Detalle } from './types';
const stable = { refetchOnWindowFocus: false, refetchOnReconnect: false };
export function useReglas(
  page: number,
  size: number,
  filters: Filtros,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['reglas-ajuste', 'list', page, size, filters],
    queryFn: ({ signal }) => reglaService.list(page, size, filters, signal),
    enabled,
  });
}
export function useRegla(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['reglas-ajuste', 'detail', id],
    queryFn: ({ signal }) => reglaService.detail(id!, signal),
    enabled: enabled && id != null,
    ...stable,
  });
}
export function useHistorial(
  id: number | null,
  page: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['reglas-ajuste', 'history', id, page],
    queryFn: ({ signal }) => reglaService.history(id!, page, signal),
    enabled: enabled && id != null,
    ...stable,
  });
}
export function useVersion(
  id: number | null,
  version: number | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['reglas-ajuste', 'version', id, version],
    queryFn: ({ signal }) => reglaService.version(id!, version!, signal),
    enabled: enabled && id != null && version != null,
    ...stable,
  });
}
export function useDestinos(ids: number[]) {
  return useQuery({
    queryKey: ['reglas-ajuste', 'destinos', ids],
    queryFn: ({ signal }) => reglaService.destinos(ids, signal),
    enabled: ids.length > 0,
    ...stable,
  });
}
export function useGuardarRegla() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: ReglaWrite }) =>
      reglaService.save(id, data),
    onSuccess: async (v, args) => {
      const detail: Detalle = {
        regla: {
          id: v.idRegla,
          nombre: args.data.nombre,
          revisionActual: v.revision,
          estado: null,
          versionPeriodo: null,
          centralizada: args.data.centralizada ?? false,
        },
        ultimaVersion: v,
      };
      client.setQueryData(['reglas-ajuste', 'detail', v.idRegla], detail);
      client.setQueryData(['reglas-ajuste', 'version', v.idRegla, v.id], v);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['reglas-ajuste', 'list'] }),
        client.invalidateQueries({ queryKey: ['reglas-ajuste', 'history'] }),
      ]);
    },
  });
}
export function useRevisarRegla() {
  return useMutation({ mutationFn: (id: number) => reglaService.detail(id) });
}
export function useProgramadas(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['reglas-ajuste', 'programadas', id],
    enabled: enabled && id != null,
    ...stable,
    queryFn: async ({ signal }) => {
      const all: import('./types').Version[] = [];
      for (let page = 1; ; page++) {
        const result = await reglaService.history(id!, page, signal);
        all.push(...result.items);
        if (all.length >= result.total || !result.items.length) break;
      }
      return all;
    },
  });
}
