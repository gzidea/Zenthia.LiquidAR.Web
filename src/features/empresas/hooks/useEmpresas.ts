import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { empresaService } from '../services/empresaService';
import type { EmpresaCompletaWrite } from '../types/empresa';
export function useEmpresas(page: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: ['empresas', 'list', page, pageSize],
    queryFn: ({ signal }) => empresaService.list(page, pageSize, signal),
    enabled,
  });
}
export function useEmpresaDetail(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['empresas', 'detail', id],
    queryFn: ({ signal }) => empresaService.detail(id!, signal),
    enabled: enabled && id !== null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useEmpresaCatalogos(enabled: boolean) {
  return useQuery({
    queryKey: ['empresas', 'catalogos'],
    queryFn: ({ signal }) => empresaService.catalogos(signal),
    enabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useEmpresaActividades(enabled: boolean) {
  return useQuery({
    queryKey: ['empresas', 'actividades-catalogo'],
    queryFn: ({ signal }) => empresaService.actividades(signal),
    enabled,
  });
}
export function useEmpresaBancos(
  page: number,
  pageSize: number,
  buscar: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['empresas', 'bancos-catalogo', page, pageSize, buscar],
    queryFn: ({ signal }) =>
      empresaService.bancos(page, pageSize, buscar, signal),
    enabled,
  });
}
export function useEmpresaMutations() {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['empresas', 'list'] });
  const save = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number | null;
      data: EmpresaCompletaWrite;
    }) => empresaService.save(id, data),
    onSuccess: async (value) => {
      client.setQueryData(['empresas', 'detail', value.empresa.id], value);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => empresaService.remove(id),
    onSuccess: refresh,
  });
  return { save, remove };
}
