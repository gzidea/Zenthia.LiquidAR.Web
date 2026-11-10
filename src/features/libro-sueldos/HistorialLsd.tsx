import { useQuery } from '@tanstack/react-query';
import { Notice } from '@/components/ui/Notice';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/services/http/ApiError';
import { libroService } from './service';

export function HistorialLsd({ id, version }: { id: number; version: number }) {
  const history = useQuery({
    queryKey: ['libro-sueldos', 'eventos', id, version],
    queryFn: ({ signal }) => libroService.eventos(id, signal),
    refetchOnWindowFocus: false,
  });
  const lastExport = history.data?.find((e) => e.operacion === 'exportar');
  return (
    <details>
      <summary>Historial y exportaciones</summary>
      <p>
        Últimos 100 eventos. Se conserva la versión y el hash, sin archivar el
        TXT. Los libros anteriores a esta función no tienen historial
        retroactivo.
      </p>
      <p>
        Cada exportación usa las referencias actuales. Cambios del legajo pueden
        modificar el TXT sin cambiar la versión del libro.
      </p>
      {history.isPending && <p role="status">Cargando historial…</p>}
      {history.isError && <Notice>{errorMessage(history.error)}</Notice>}
      {lastExport && lastExport.versionResultado !== version && (
        <p role="status">
          La versión actual cambió desde la última exportación registrada. Esto
          incluye cambios de pago; Exportado conserva su significado histórico.
        </p>
      )}
      {history.data && history.data.length === 0 && (
        <p>No hay eventos registrados.</p>
      )}
      <ul>
        {history.data?.map((e) => (
          <li key={e.id}>
            {new Date(e.creadoEn).toLocaleString()} · {e.operacion} · Usuario{' '}
            {e.userId} · Versión {e.versionOrigen} → {e.versionResultado}
            {e.sha256 && (
              <>
                <br />
                <code style={{ overflowWrap: 'anywhere' }}>
                  SHA-256: {e.sha256}
                </code>{' '}
                · {e.bytes} bytes
              </>
            )}
          </li>
        ))}
      </ul>
      <Button
        disabled={history.isFetching}
        onClick={() => void history.refetch()}
      >
        Actualizar historial
      </Button>
    </details>
  );
}
