import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { novedadesService as api } from './service';
import type { Contexto, Cambio } from './types';

const stable = { refetchOnWindowFocus: false, refetchOnReconnect: false };
export function useNovedades(
  c: Contexto,
  page: number,
  size: number,
  buscar: string,
  convenio: string,
  estado: string,
  empresaBuscar: string,
  enabled: boolean,
) {
  const valid =
    enabled &&
    /^(0[1-9]|1[0-2])\d{4}$/.test(c.periodo) &&
    c.idTipoLiquidacion > 0;
  const tipos = useQuery({
    queryKey: ['novedades', 'tipos'],
    queryFn: ({ signal }) => api.catalog('tipos-liquidacion', signal),
    enabled,
    ...stable,
  });
  const convenios = useQuery({
    queryKey: ['novedades', 'convenios'],
    queryFn: ({ signal }) => api.catalog('convenios', signal),
    enabled,
    ...stable,
  });
  const empresas = useQuery({
    queryKey: [
      'novedades',
      'empresas',
      c.periodo,
      c.idTipoLiquidacion,
      empresaBuscar,
    ],
    queryFn: ({ signal }) =>
      api.empresas(c.periodo, c.idTipoLiquidacion, empresaBuscar, signal),
    enabled: valid,
    ...stable,
  });
  const filas = useQuery({
    queryKey: ['novedades', 'filas', c, page, size, buscar, convenio, estado],
    queryFn: ({ signal }) =>
      api.filas(c, page, size, buscar, convenio, estado, signal),
    enabled: valid && c.idEmpresa > 0,
    ...stable,
  });
  const client = useQueryClient();
  const quitar = useMutation({
    mutationFn: (r: { id: number; revision: number }) =>
      api.quitar(c, r.id, r.revision),
    onSuccess: () => client.invalidateQueries({ queryKey: ['novedades'] }),
  });
  const guardar = useMutation({
    mutationFn: (cambios: Cambio[]) => api.guardar(c, cambios),
    onSuccess: () => client.invalidateQueries({ queryKey: ['novedades'] }),
  });
  const importar = useMutation({
    mutationFn: (r: { fecha: string; convenio: number; file: File }) =>
      api.importar(c, r.convenio, r.fecha, r.file),
  });
  const plantilla = useMutation({
    mutationFn: (id: number) => api.plantilla(c, id),
  });
  return {
    quitar,
    tipos,
    convenios,
    empresas,
    filas,
    guardar,
    importar,
    plantilla,
  };
}
