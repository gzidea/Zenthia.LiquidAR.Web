import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { formulasEmpresaApi as api } from '@/features/formulas-empresa/service';

export function useConveniosHabilitados(enabled: boolean) {
  const revision = useAuthStore((s) => s.revision);
  const client = useQueryClient();
  const catalogo = useQuery({
    queryKey: ['formulas-empresa', revision, 'convenios-tenant'],
    queryFn: ({ signal }) => api.conveniosTenant(signal),
    enabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const invalidate = () =>
    client.invalidateQueries({ queryKey: ['formulas-empresa', revision] });
  const agregar = useMutation({
    mutationFn: (ids: number[]) => api.agregarConvenios(ids),
    onSuccess: invalidate,
  });
  const cambiarEstado = useMutation({
    mutationFn: ({ id, habilitado }: { id: number; habilitado: boolean }) =>
      api.habilitarTenant(id, habilitado),
    onSuccess: invalidate,
  });
  return { catalogo, agregar, cambiarEstado };
}
