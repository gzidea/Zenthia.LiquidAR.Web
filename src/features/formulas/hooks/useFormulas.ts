import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formulaService } from '../services/formulaService';
import type { CatalogKind, Filtros, FormulaWrite } from '../types/formula';
export function useFormulaOrder(convenioId: number) {
  return useQuery({
    queryKey: ['formulas', 'order', convenioId],
    queryFn: ({ signal }) => formulaService.order(convenioId, signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
    retry: false,
  });
}
export function useSaveFormulaOrder(convenioId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, huella }: { ids: number[]; huella: string }) =>
      formulaService.saveOrder(convenioId, ids, huella),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['formulas', 'list'] }),
        client.invalidateQueries({ queryKey: ['formulas', 'detail'] }),
      ]);
    },
  });
}
export function useFormulas(
  page: number,
  pageSize: number,
  filtros: Filtros,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['formulas', 'list', page, pageSize, filtros],
    queryFn: ({ signal }) =>
      formulaService.list(page, pageSize, filtros, signal),
    enabled,
  });
}
export function useFormulaDetail(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['formulas', 'detail', id],
    queryFn: ({ signal }) => formulaService.detail(id!, signal),
    enabled: enabled && id !== null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useFormulaCatalog(kind: CatalogKind, enabled: boolean) {
  return useQuery({
    queryKey: ['formulas', 'catalog', kind],
    queryFn: ({ signal }) => formulaService.catalog(kind, signal),
    enabled,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useFormulaMutations() {
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: ({
      id,
      data,
      clone,
    }: {
      id: number | null;
      data: FormulaWrite;
      clone?: boolean;
    }) => formulaService.save(id, data, clone),
    onSuccess: async (value) => {
      client.setQueryData(['formulas', 'detail', value.formula.id], value);
      await client.invalidateQueries({ queryKey: ['formulas', 'list'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => formulaService.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['formulas'] }),
  });
  const duplicate = useMutation({
    mutationFn: (id: number) => formulaService.duplicate(id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['formulas', 'list'] }),
  });
  const exportar = useMutation({
    mutationFn: (f: Filtros) => formulaService.exportar(f),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Formulas.xlsx';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  return { save, remove, duplicate, exportar };
}
