import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/services/http/ApiError';
import { libroService } from './service';

export function EstadoPersistidoLsd({
  id,
  empresa,
  periodo,
  onReviewed,
}: {
  id: number;
  empresa: number | null;
  periodo: string | null;
  onReviewed?: () => void;
}) {
  const estado = useQuery({
    queryKey: ['lsd-recovery', id, empresa, periodo],
    queryFn: async ({ signal }) => {
      if (id) {
        const book = await libroService.detail(id, signal);
        const eventos = await libroService.eventos(id, signal);
        return { libros: [book.cabecera], eventos, total: 1 };
      }
      const page = await libroService.list(
        1,
        100,
        empresa ?? undefined,
        periodo ?? undefined,
        signal,
      );
      return { libros: page.items, eventos: [], total: page.total };
    },
    enabled: false,
    retry: false,
  });
  return (
    <section aria-label="Recuperar operación incierta">
      <p>
        La respuesta se interrumpió y la operación podría haberse guardado. No
        se reintentará automáticamente. Consultá el estado antes de volver a
        guardar o exportar.
      </p>
      <Button
        disabled={estado.isFetching}
        onClick={async () => {
          const result = await estado.refetch();
          if (result.isSuccess) onReviewed?.();
        }}
      >
        Consultar estado persistido
      </Button>
      {estado.isFetching && <p role="status">Consultando estado persistido…</p>}
      {estado.isError && <Notice>{errorMessage(estado.error)}</Notice>}
      {estado.data && (
        <>
          <p>
            Encontrados: {estado.data.total}. Se muestran como máximo 100
            libros. Para una creación, la coincidencia de empresa/período no
            prueba que sea tu operación: revisá el número y los datos antes de
            repetirla.
          </p>
          <ul>
            {estado.data.libros.map((b) => (
              <li key={b.id}>
                Libro {b.id} · N.º {b.numeroDeLiquidacion} · Versión {b.version}{' '}
                · Generado: {b.generado ? 'Sí' : 'No'} · Exportado:{' '}
                {b.exportado ? 'Sí' : 'No'}
              </li>
            ))}
          </ul>
          <ul>
            {estado.data.eventos
              .filter((e) => e.operacion === 'exportar')
              .slice(0, 3)
              .map((e) => (
                <li key={e.id}>
                  Exportación {new Date(e.creadoEn).toLocaleString()} · Versión{' '}
                  {e.versionOrigen} → {e.versionResultado} · SHA-256:{' '}
                  <code style={{ overflowWrap: 'anywhere' }}>{e.sha256}</code>
                </li>
              ))}
          </ul>
          <p>
            La consulta no reemplaza tu borrador ni repite la operación. Si se
            guardó, cerrá el formulario y abrí ese libro.
          </p>
        </>
      )}
    </section>
  );
}
