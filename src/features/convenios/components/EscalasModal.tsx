import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { Button } from '@/components/ui/Button';
import { DataGrid, type DataGridColumn } from '@/components/ui/DataGrid';
import { errorMessage } from '@/services/http/ApiError';
import { useConvenioDetail } from '../hooks/useConvenios';
import { month, monthInput, periodo } from '../schemas/convenioSchema';
import type { CategoriaResumen, VersionImporte } from '../types/convenio';
import { EscalaEditor } from './EscalaEditor';
import { EscalaHistorial } from './EscalaHistorial';
const columns: DataGridColumn<CategoriaResumen>[] = [
  { field: 'codigo', header: 'Código', getValue: (r) => r.categoria.codigo },
  {
    field: 'descripcion',
    header: 'Categoría',
    getValue: (r) => r.categoria.descripcion,
  },
  {
    field: 'importe',
    header: 'Importe',
    getValue: (r) => r.escala?.version.importe ?? 'Sin importe',
  },
  {
    field: 'adicional1',
    header: 'Adicional 1',
    getValue: (r) => r.escala?.version.adicional1 ?? 'Sin importe',
  },
  {
    field: 'adicional2',
    header: 'Adicional 2',
    getValue: (r) => r.escala?.version.adicional2 ?? 'Sin importe',
  },
  {
    field: 'desde',
    header: 'Vigente desde',
    getValue: (r) =>
      r.escala?.version.periodoDesde.slice(0, 7) ?? 'Sin cobertura',
  },
  {
    field: 'proxima',
    header: 'Próxima escala',
    getValue: (r) =>
      r.proximaEscala?.periodoDesde.slice(0, 7) ?? 'Sin programación',
  },
];
export function EscalasModal({
  id,
  canWrite,
  onClose,
}: {
  id: number;
  canWrite: boolean;
  onClose: () => void;
}) {
  const [mes, setMes] = useState('');
  const [initialVersion, setInitialVersion] = useState<
    VersionImporte | undefined
  >();
  const [editor, setEditor] = useState<number[] | null>(null);
  const [history, setHistory] = useState<CategoriaResumen | null>(null);
  const [revisionMes, setRevisionMes] = useState<string | undefined>();
  const query = useConvenioDetail(
    id,
    mes === '' || month.safeParse(mes).success,
    mes ? periodo(mes) : undefined,
  );
  const data = query.data;
  return (
    <>
      <Modal
        open
        size="large"
        title="Escalas del convenio"
        subtitle={data?.convenio.nombre ?? undefined}
        onClose={onClose}
        acceptButton={false}
        cancelButton={{ label: 'Cerrar' }}
      >
        <div className="convenio-form">
          <div className="convenio-toolbar">
            <Input
              label="Período de consulta"
              type="month"
              value={mes || (data ? monthInput(data.periodo) : '')}
              onChange={(e) => setMes(e.target.value)}
            />
            <Button
              variant="ghost"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              Refrescar
            </Button>
          </div>
          <DataGrid
            label="Escalas por categoría"
            rows={data?.categorias ?? []}
            columns={columns}
            getRowId={(r) => r.categoria.id}
            loading={query.isFetching}
            error={query.isError ? errorMessage(query.error) : null}
            onRetry={() => void query.refetch()}
            rowHeight={48}
            initialState={{ pagination: { page: 0, pageSize: 25 } }}
            pageSizeOptions={[10, 25, 50, 100]}
            selectionMode={canWrite ? 'multiple' : 'none'}
            checkboxSelection={canWrite}
            selectAll="page"
            emptyMessage="El convenio no tiene categorías."
            rowActions={[
              {
                id: 'scale',
                label: 'Nueva escala',
                visible: () => canWrite,
                disabled: () => query.isFetching,
                onClick: (r) => setEditor([r.categoria.id]),
              },
              {
                id: 'correct-initial',
                label: 'Corregir escala inicial',
                visible: (r) => canWrite && !!r.escalaInicial,
                disabled: () => query.isFetching,
                onClick: (r) => {
                  setInitialVersion(r.escalaInicial!);
                  setRevisionMes(r.escalaInicial!.periodoDesde.slice(0, 7));
                  setEditor([r.categoria.id]);
                },
              },
              { id: 'history', label: 'Historial', onClick: setHistory },
            ]}
            bulkActions={[
              {
                id: 'adjust',
                label: 'Ajustar seleccionadas',
                visible: () => canWrite,
                disabled: () => query.isFetching,
                onClick: (context) =>
                  setEditor(context.loadedRows.map((r) => r.categoria.id)),
              },
            ]}
          />
          <p className="field-note">
            La consulta muestra los importes aplicables al período elegido. Una
            programación futura no modifica los recibos ya guardados.
          </p>
        </div>
        {query.isError && !data && <Notice>{errorMessage(query.error)}</Notice>}
      </Modal>
      {editor && data && (
        <EscalaEditor
          id={id}
          ids={editor}
          operativo={data.periodoOperativo}
          initialMes={revisionMes}
          initialVersion={initialVersion}
          onClose={() => {
            setEditor(null);
            setRevisionMes(undefined);
            setInitialVersion(undefined);
          }}
        />
      )}
      {history && data && (
        <EscalaHistorial
          convenioId={id}
          row={history}
          operativo={data.periodoOperativo}
          canWrite={canWrite}
          onClose={() => setHistory(null)}
          onRevise={(m) => {
            setEditor([history.categoria.id]);
            setHistory(null);
            setRevisionMes(m);
          }}
        />
      )}
    </>
  );
}
