import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { formulasEmpresaApi as api } from './service';
import type {
  AgrupacionWrite,
  ExclusionWrite,
  PublicacionWrite,
} from './service';

export function useConfiguracionFormulas(empresa: number) {
  const revision = useAuthStore((s) => s.revision);
  const client = useQueryClient();
  const base = ['formulas-empresa', revision, empresa];
  const comunes = {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  };
  const agrupaciones = useQuery({
    ...comunes,
    queryKey: [...base, 'agrupaciones'],
    queryFn: ({ signal }) => api.agrupaciones(empresa, signal),
  });
  const opciones = useQuery({
    ...comunes,
    queryKey: [...base, 'opciones'],
    queryFn: ({ signal }) => api.opciones(empresa, signal),
  });
  const propias = useQuery({
    ...comunes,
    queryKey: [...base, 'propias'],
    queryFn: ({ signal }) => api.propias(empresa, signal),
  });
  const exclusiones = useQuery({
    ...comunes,
    queryKey: [...base, 'exclusiones'],
    queryFn: ({ signal }) => api.exclusiones(empresa, signal),
  });
  const catalogos = useQuery({
    ...comunes,
    queryKey: [...base, 'catalogos'],
    queryFn: ({ signal }) => api.catalogos(empresa, signal),
  });
  const invalidate = async () => {
    await client.invalidateQueries({
      queryKey: ['formulas-empresa', revision],
    });
  };
  const guardarGrupo = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: AgrupacionWrite }) =>
      api.guardarGrupo(empresa, id, data),
    onSuccess: invalidate,
  });
  const publicar = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: PublicacionWrite }) =>
      api.publicar(empresa, id, data),
    onSuccess: invalidate,
  });
  const guardarExclusion = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: ExclusionWrite }) =>
      api.guardarExclusion(empresa, id, data),
    onSuccess: invalidate,
  });
  return {
    agrupaciones,
    opciones,
    propias,
    exclusiones,
    catalogos,
    guardarGrupo,
    publicar,
    guardarExclusion,
  };
}
