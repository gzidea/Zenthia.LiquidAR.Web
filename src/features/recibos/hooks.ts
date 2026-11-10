import { useQuery, useMutation } from '@tanstack/react-query';
import { recibosService as api } from './service';
import { parseVista } from './reciboPreview';
import type { RecibosFiltro } from './listado';
export function useRecibosListado(filter: RecibosFiltro, enabled: boolean) {
  const tipos = useQuery({
    queryKey: ['recibos', 'tipos'],
    queryFn: ({ signal }) => api.tipos(signal),
    enabled,
    ...stable,
  });
  const valid = enabled && !!filter.periodo && !!filter.idTipoLiquidacion;
  const empresas = useQuery({
    queryKey: ['recibos', 'empresas', filter.periodo, filter.idTipoLiquidacion],
    queryFn: ({ signal }) =>
      api.empresas(filter.periodo!, filter.idTipoLiquidacion!, signal),
    enabled: valid,
    ...stable,
  });
  const filas = useQuery({
    queryKey: ['recibos', 'listado', filter],
    queryFn: ({ signal }) => api.listado(filter, signal),
    enabled: valid,
    ...stable,
  });
  return { tipos, empresas, filas };
}
const stable = { refetchOnWindowFocus: false, refetchOnReconnect: false };
export function useRecibosZip() {
  return useMutation({
    mutationFn: ({ ids, signal }: { ids: number[]; signal: AbortSignal }) =>
      api.zip(ids, signal),
    retry: false,
  });
}
export type ReciboPreviewTarget = { id: number } | { vista: unknown };
export function useReciboPreview(target: ReciboPreviewTarget) {
  return useQuery({
    queryKey: ['recibos', 'recibo-preview', target],
    queryFn: ({ signal }) =>
      'id' in target
        ? api.previsualizacion(target.id, signal)
        : Promise.resolve(parseVista(target.vista)),
    retry: false,
    ...stable,
  });
}
