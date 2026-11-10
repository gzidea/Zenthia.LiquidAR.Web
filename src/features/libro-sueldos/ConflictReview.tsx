import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/services/http/ApiError';
import { libroService } from './service';
import type { Libro, FieldSpec } from './types';
import { fields01, fields02, fields03, fields04 } from './fields';

const comparisonGroups: Record<string, { title: string; fields: FieldSpec[] }> =
  {
    cabecera: { title: 'Cabecera', fields: fields01 },
    registros02: { title: 'Registro 02', fields: fields02 },
    registros03: { title: 'Registro 03', fields: fields03 },
    registros04: { title: 'Registro 04', fields: fields04 },
  };
function nombreCampo(path: string) {
  const [section, index, field] = path.split('.');
  const group = comparisonGroups[section ?? ''];
  if (!group) return path;
  const key = section === 'cabecera' ? index : field;
  const label =
    group.fields.find((f) => f.name === key)?.label ??
    (key === 'version' ? 'Versión' : key === 'id' ? 'Identificador' : key);
  return `${group.title}${section !== 'cabecera' ? ` · Fila ${Number(index) + 1}` : ''} · ${label ?? 'Registro'}`;
}

export function diferencias(
  local: unknown,
  remoto: unknown,
  path = '',
): { campo: string; local: string; guardado: string }[] {
  if (JSON.stringify(local) === JSON.stringify(remoto)) return [];
  if (
    local !== null &&
    remoto !== null &&
    typeof local === 'object' &&
    typeof remoto === 'object'
  ) {
    const a = local as Record<string, unknown>,
      b = remoto as Record<string, unknown>;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) =>
      diferencias(a[k], b[k], path ? `${path}.${k}` : k),
    );
  }
  return [
    {
      campo: path,
      local: String(local ?? '—'),
      guardado: String(remoto ?? '—'),
    },
  ];
}

export function ConflictReview({
  local,
  onReload,
}: {
  local: Libro;
  onReload: (value: Libro) => void;
}) {
  const remote = useQuery({
    queryKey: [
      'lsd-conflict-review',
      local.cabecera.id,
      local.cabecera.version,
    ],
    queryFn: ({ signal }) => libroService.detail(local.cabecera.id, signal),
    enabled: false,
    retry: false,
  });
  return (
    <section aria-label="Comparar versiones">
      <p>
        Tu borrador se conserva. Consultá la versión guardada para comparar
        antes de decidir si querés reemplazarlo.
      </p>
      <Button
        disabled={remote.isFetching}
        onClick={() => void remote.refetch()}
      >
        Consultar versión guardada
      </Button>
      {remote.isFetching && <p role="status">Consultando versión guardada…</p>}
      {remote.isError && <Notice>{errorMessage(remote.error)}</Notice>}
      {remote.data && (
        <>
          <p>
            Comparación con el borrador enviado. Los cambios que hagas después
            de ese intento no se incluyen.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <caption>Diferencias entre versiones</caption>
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Borrador enviado</th>
                  <th style={{ minWidth: '5rem', whiteSpace: 'nowrap' }}>
                    Guardado
                  </th>
                </tr>
              </thead>
              <tbody>
                {diferencias(local, remote.data).map((d) => (
                  <tr key={d.campo}>
                    <th scope="row">{nombreCampo(d.campo)}</th>
                    <td>{d.local}</td>
                    <td>{d.guardado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={() => onReload(remote.data)}>
            Descartar borrador y cargar versión guardada
          </Button>
        </>
      )}
    </section>
  );
}
