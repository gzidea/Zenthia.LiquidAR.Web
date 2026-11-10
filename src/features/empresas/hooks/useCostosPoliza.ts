import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { empresaService } from '../services/empresaService';
import type { CostoPolizaWrite } from '../types/costoPoliza';

export function useCostosPoliza(id: number, periodo: string) {
  const client = useQueryClient();
  const key = ['empresas', 'costos-poliza', id, periodo];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => empresaService.costosPoliza(id, periodo, signal),
    enabled: /^(0[1-9]|1[0-2])[0-9]{4}$/.test(periodo),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const publicar = useMutation({
    mutationFn: (data: CostoPolizaWrite) =>
      empresaService.publicarCostoPoliza(id, data),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  return { query, publicar };
}
