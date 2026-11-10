import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Contexto } from '@/features/novedades/types';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { liquidacionesService } from './service';
export function useLiquidaciones(
  c: Contexto,
  pagination: { page: number; pageSize: number },
  buscar: string,
  enabled: boolean,
  estado = '',
  convenio = '',
) {
  const tipos = useQuery({
    queryKey: ['liquidaciones', 'tipos'],
    queryFn: ({ signal }) => liquidacionesService.tipos(signal),
    enabled,
  });
  const empresas = useQuery({
    queryKey: ['liquidaciones', 'empresas', c.periodo, c.idTipoLiquidacion],
    queryFn: ({ signal }) => liquidacionesService.empresas(c, signal),
    enabled: enabled && c.idTipoLiquidacion > 0 && c.periodo.length === 6,
  });
  const convenios = useQuery({
    queryKey: ['liquidaciones', 'convenios'],
    queryFn: ({ signal }) => liquidacionesService.convenios(signal),
    enabled,
  });
  const filas = useQuery({
    queryKey: [
      'liquidaciones',
      'filas',
      c,
      pagination,
      buscar,
      estado,
      convenio,
    ],
    queryFn: ({ signal }) =>
      liquidacionesService.filas(
        c,
        pagination.page + 1,
        pagination.pageSize,
        buscar,
        signal,
        estado,
        convenio,
      ),
    enabled:
      enabled &&
      c.idTipoLiquidacion > 0 &&
      c.idEmpresa > 0 &&
      c.periodo.length === 6,
    refetchOnWindowFocus: false,
  });
  const client = useQueryClient();
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['liquidaciones'] }),
      client.invalidateQueries({ queryKey: ['novedades'] }),
      client.invalidateQueries({ queryKey: ['recibos'] }),
    ]);
  };
  const action = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
  });
  return { tipos, empresas, filas, invalidate, action, convenios };
}
export function useLiquidacionesCapacidades() {
  const revision = useAuthStore((s) => s.revision);
  const authenticated = useAuthStore(
    (s) => s.session.status === 'authenticated',
  );
  return useQuery({
    queryKey: ['liquidaciones', 'capacidades', revision],
    queryFn: ({ signal }) => liquidacionesService.capacidades(signal),
    enabled: authenticated,
    staleTime: 60000,
  });
}
