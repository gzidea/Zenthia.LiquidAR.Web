import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/services/http/ApiError';
import { useFormulaOrder, useSaveFormulaOrder } from '../hooks/useFormulas';
import type { FormulaOrder, FormulaOrderRow } from '../types/formula';

export function FormulaOrderDialog({
  convenioId,
  convenioNombre,
  onClose,
  onSaved,
}: {
  convenioId: number;
  convenioNombre: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const query = useFormulaOrder(convenioId);
  return query.data && !query.isFetching && !query.isError ? (
    <OrderEditor
      initial={query.data}
      convenioId={convenioId}
      convenioNombre={convenioNombre}
      onClose={onClose}
      onSaved={onSaved}
    />
  ) : (
    <Modal
      open
      title={`Organizar orden · ${convenioNombre}`}
      onClose={onClose}
      acceptButton={false}
      cancelButton={{ label: 'Cerrar' }}
    >
      {query.isError ? (
        <>
          <Notice>{errorMessage(query.error)}</Notice>
          <Button onClick={() => void query.refetch()}>Reintentar</Button>
        </>
      ) : (
        <p role="status">Cargando todas las fórmulas del convenio…</p>
      )}
    </Modal>
  );
}

function OrderEditor({
  initial,
  convenioId,
  convenioNombre,
  onClose,
  onSaved,
}: {
  initial: FormulaOrder;
  convenioId: number;
  convenioNombre: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState(initial.formulas);
  const [dragged, setDragged] = useState<number | null>(null);
  const [discard, setDiscard] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const save = useSaveFormulaOrder(convenioId);
  const dirty = rows.some(
    (row, index) =>
      row.id !== initial.formulas[index]?.id || row.orden !== index + 1,
  );
  function move(id: number, target: number) {
    if (save.isPending || target < 0 || target >= rows.length) return;
    const source = rows.findIndex((row) => row.id === id);
    if (source < 0 || source === target) return;
    const next = [...rows];
    const [row] = next.splice(source, 1);
    next.splice(target, 0, row!);
    setRows(next);
    setAnnouncement(
      `${row!.descripcion ?? row!.variable}: posición ${target + 1} de ${rows.length}`,
    );
  }
  function close() {
    if (!save.isPending) {
      if (dirty) setDiscard(true);
      else onClose();
    }
  }
  const label = (row: FormulaOrderRow) =>
    row.descripcion || row.variable || `ID ${row.id}`;
  return (
    <>
      <Modal
        open
        title={`Organizar orden · ${convenioNombre}`}
        size="large"
        onClose={close}
        closeDisabled={save.isPending}
        cancelButton={{ label: 'Cancelar', disabled: save.isPending }}
        acceptButton={{
          label: 'Guardar orden',
          loading: save.isPending,
          disabled: !dirty || !rows.length,
        }}
        onAccept={async () => {
          if (save.isPending || !dirty || !rows.length) return;
          try {
            await save.mutateAsync({
              ids: rows.map((row) => row.id),
              huella: initial.huella,
            });
            onSaved();
          } catch {
            /* Conservar el borrador para revisión o cancelación. */
          }
        }}
      >
        <p>
          Incluye todas las fórmulas del convenio, también las inactivas.
          Arrastrá desde ↕ o utilizá Subir y Bajar. Se guardarán órdenes
          consecutivos desde 1.
        </p>
        <p>
          Los conceptos utilizados por otros deben quedar antes: esta secuencia
          se aplica al cálculo.
        </p>
        {save.isError && (
          <Notice>
            {save.error instanceof Error &&
            'status' in save.error &&
            save.error.status === 409
              ? 'Las fórmulas o su orden cambiaron. Conservamos tu borrador; cancelá y volvé a abrir para cargar la versión actual.'
              : errorMessage(save.error)}
          </Notice>
        )}
        <p role="status" aria-live="polite">
          {announcement}
        </p>
        {!rows.length ? (
          <p>No hay fórmulas en este convenio.</p>
        ) : (
          <div className="formula-order-scroll">
            <table
              className="formula-order-table"
              aria-label="Orden de las fórmulas"
            >
              <thead>
                <tr>
                  <th>Mover</th>
                  <th>Orden</th>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Variable</th>
                  <th>Estado</th>
                  <th>Posición</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    onDragOver={(event) => {
                      if (dragged !== null && !save.isPending)
                        event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragged !== null) move(dragged, index);
                      setDragged(null);
                    }}
                  >
                    <td>
                      <button
                        type="button"
                        draggable={!save.isPending}
                        disabled={save.isPending}
                        aria-label={`Arrastrar ${label(row)}`}
                        onDragStart={(event) => {
                          setDragged(row.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData(
                            'text/plain',
                            String(row.id),
                          );
                        }}
                        onDragEnd={() => setDragged(null)}
                      >
                        ↕
                      </button>
                    </td>
                    <td>{index + 1}</td>
                    <td>{row.codigo ?? '—'}</td>
                    <td>{label(row)}</td>
                    <td>{row.variable}</td>
                    <td>{row.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      <Button
                        variant="ghost"
                        disabled={save.isPending || index === 0}
                        aria-label={`Subir ${label(row)}`}
                        onClick={() => move(row.id, index - 1)}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={save.isPending || index === rows.length - 1}
                        aria-label={`Bajar ${label(row)}`}
                        onClick={() => move(row.id, index + 1)}
                      >
                        ↓
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
      {discard && (
        <Modal
          open
          title="Descartar cambios de orden"
          onClose={() => setDiscard(false)}
          acceptButton={{ label: 'Descartar cambios' }}
          onAccept={onClose}
          cancelButton={{ label: 'Seguir organizando' }}
        >
          <p>Hay cambios pendientes. ¿Querés descartarlos?</p>
        </Modal>
      )}
    </>
  );
}
