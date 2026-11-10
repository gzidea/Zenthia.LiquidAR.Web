import { useEffect, useState } from 'react';
import { DataGrid, type DataGridColumn } from '@/components/ui/DataGrid';
import { Modal } from '@/components/ui/Modal';
import {
  FormDialogActions,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { DataGridSkeleton } from '@/components/ui/Skeleton';
import { errorMessage } from '@/services/http/ApiError';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { ConvenioForm, ConvenioFormSkeleton } from '../components/ConvenioForm';
import { EscalasModal } from '../components/EscalasModal';
import {
  useConvenios,
  useConvenioDetail,
  useConvenioMutations,
} from '../hooks/useConvenios';
import type { Convenio, ConvenioWrite } from '../types/convenio';
import './convenios.css';
const columns: DataGridColumn<Convenio>[] = [
  { field: 'codigo', header: 'Código', getValue: (r: Convenio) => r.codigo },
  { field: 'nombre', header: 'Nombre', getValue: (r: Convenio) => r.nombre },
  {
    field: 'descripcion',
    header: 'Descripción',
    getValue: (r: Convenio) => r.descripcion,
  },
].map((c) => ({ ...c, sortable: false, filterable: false, searchable: false }));
type Editor =
  | { kind: 'create' }
  | { kind: 'edit' | 'view' | 'scales'; id: number }
  | { kind: 'delete'; row: Convenio }
  | null;
export function ConveniosPage() {
  const permissions = usePermissions();
  const canRead = permissions.can('convenios:read');
  const canWrite = canRead && permissions.can('convenios:write');
  const canDelete = canRead && permissions.can('convenios:delete');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [editor, setEditor] = useState<Editor>(null);
  const [version, setVersion] = useState(0);
  const [feedback, setFeedback] = useState('');
  const list = useConvenios(pagination.page + 1, pagination.pageSize, canRead);
  const editing = editor?.kind === 'edit';
  const viewing = editor?.kind === 'view';
  const formOpen = editing || viewing || editor?.kind === 'create';
  const detail = useConvenioDetail(
    editing || viewing ? editor.id : null,
    formOpen && canRead,
  );
  const { save, remove } = useConvenioMutations();
  const busy = save.isPending || remove.isPending;
  const loading =
    (editing || viewing) && (detail.isPending || detail.isFetching);
  const formError = editing || viewing ? detail.error : null;
  useEffect(() => {
    document.title = 'Convenios | Zenthia.LiquidAR.Web';
    if (!permissions.isPending)
      document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [permissions.isPending]);
  useEffect(() => {
    if (!list.data || list.isFetching) return;
    const last = Math.max(
      0,
      Math.ceil(list.data.total / pagination.pageSize) - 1,
    );
    if (pagination.page > last) setPagination((p) => ({ ...p, page: last }));
  }, [list.data, list.isFetching, pagination.page, pagination.pageSize]);
  const open = (value: Editor) => {
    save.reset();
    remove.reset();
    setFeedback('');
    setVersion((v) => v + 1);
    setEditor(value);
  };
  const close = () => {
    if (!busy) setEditor(null);
  };
  const submit = async (data: ConvenioWrite, destination: SaveDestination) => {
    if (!canWrite || busy || viewing || !formOpen) return;
    try {
      const saved = await save.mutateAsync({
        id: editing ? editor.id : null,
        data,
      });
      setFeedback('El convenio se guardó correctamente.');
      setVersion((v) => v + 1);
      setEditor(
        destination === 'close'
          ? null
          : destination === 'new'
            ? { kind: 'create' }
            : { kind: 'edit', id: saved.convenio.id },
      );
    } catch {
      /* Keep draft and show mutation error. */
    }
  };
  if (permissions.isPending)
    return (
      <section>
        <h1 tabIndex={-1}>Convenios</h1>
        <DataGridSkeleton columns={3} actions label="Cargando permisos…" />
      </section>
    );
  if (permissions.isError)
    return (
      <>
        <Notice>{errorMessage(permissions.error)}</Notice>
        <Button onClick={() => void permissions.refetch()}>
          Reintentar permisos
        </Button>
      </>
    );
  if (!canRead)
    return (
      <>
        <h1 tabIndex={-1}>Convenios</h1>
        <Notice>No tenés permiso para consultar convenios.</Notice>
      </>
    );
  return (
    <section className="convenios-page">
      <h1 tabIndex={-1}>Convenios</h1>
      <DataGrid
        label="Convenios"
        rows={list.isError ? [] : (list.data?.items ?? [])}
        columns={columns}
        getRowId={(r) => r.id}
        processingMode="server"
        rowCount={list.data?.total ?? 0}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        pageSizeOptions={[10, 25, 50, 100]}
        rowHeight={48}
        selectionMode="multiple"
        checkboxSelection
        selectAll="page"
        searchDisabled
        filterButtonDisabled
        searchUnavailableReason="La API de Convenios todavía no admite búsqueda."
        filtersUnavailableReason="La API de Convenios todavía no admite filtros."
        loading={list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => void list.refetch()}
        emptyMessage="No hay convenios para mostrar."
        globalActions={[
          {
            id: 'refresh',
            label: 'Refrescar',
            disabled: list.isFetching,
            onClick: () => void list.refetch(),
          },
          {
            id: 'create',
            label: 'Nuevo',
            icon: <Icon name="plus" />,
            display: 'icon-text',
            visible: canWrite,
            onClick: () => open({ kind: 'create' }),
          },
        ]}
        rowActions={[
          {
            id: 'view',
            label: 'Ver',
            icon: <Icon name="eye" />,
            display: 'icon-text',
            onClick: (r) => open({ kind: 'view', id: r.id }),
          },
          {
            id: 'edit',
            label: 'Editar',
            icon: <Icon name="edit" />,
            display: 'icon-text',
            visible: () => canWrite,
            onClick: (r) => open({ kind: 'edit', id: r.id }),
          },
          {
            id: 'scales',
            label: 'Escalas',
            onClick: (r) => open({ kind: 'scales', id: r.id }),
          },
          {
            id: 'delete',
            label: 'Eliminar',
            visible: () => canDelete,
            onClick: (row) => open({ kind: 'delete', row }),
          },
        ]}
      />
      {feedback && !formOpen && <p role="status">{feedback}</p>}
      <Modal
        open={formOpen && (viewing || canWrite)}
        size="large"
        title={
          viewing
            ? 'Ver convenio'
            : editing
              ? 'Editar convenio'
              : 'Nuevo convenio'
        }
        titleIcon={<Icon name={viewing ? 'eye' : 'edit'} />}
        subtitle="Datos generales y categorías."
        onClose={close}
        closeDisabled={busy}
        acceptButton={
          viewing
            ? false
            : {
                label: 'Guardar y cerrar',
                type: 'submit',
                form: 'convenio-form',
                loading: save.isPending,
                disabled: loading || !!formError,
              }
        }
        cancelButton={{
          label: viewing ? 'Cerrar' : 'Cancelar',
          disabled: busy,
        }}
        actions={
          viewing ? undefined : (
            <FormDialogActions
              form="convenio-form"
              busy={busy}
              loading={loading}
              hasError={!!formError}
              onUndo={() => {
                save.reset();
                setFeedback('');
                setVersion((v) => v + 1);
                if (editing) void detail.refetch();
              }}
            />
          )
        }
      >
        {feedback && <p role="status">{feedback}</p>}
        {loading && !formError && <ConvenioFormSkeleton />}
        {formError && (
          <>
            <Notice>{errorMessage(formError)}</Notice>
            <Button onClick={() => void detail.refetch()}>
              Reintentar datos
            </Button>
          </>
        )}
        {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
        {!loading && !formError && (
          <ConvenioForm
            key={`${editing || viewing ? editor.id : 'new'}-${version}`}
            initial={editing || viewing ? detail.data : undefined}
            busy={busy}
            readOnly={viewing}
            canDelete={canDelete}
            onSubmit={submit}
          />
        )}
      </Modal>
      {editor?.kind === 'scales' && (
        <EscalasModal id={editor.id} canWrite={canWrite} onClose={close} />
      )}
      <Modal
        open={editor?.kind === 'delete' && canDelete}
        title="Confirmar eliminación"
        onClose={close}
        closeDisabled={busy}
        acceptButton={{ label: 'Eliminar', loading: remove.isPending }}
        cancelButton={{ disabled: busy }}
        onAccept={async () => {
          if (editor?.kind !== 'delete' || busy || !canDelete) return;
          try {
            await remove.mutateAsync(editor.row.id);
            setFeedback('El convenio se eliminó correctamente.');
            setEditor(null);
          } catch {
            /* Show normalized error. */
          }
        }}
      >
        <p>
          ¿Deseás eliminar el convenio{' '}
          {editor?.kind === 'delete'
            ? (editor.row.nombre ?? editor.row.codigo ?? editor.row.id)
            : ''}
          ?
        </p>
        {remove.isError && <Notice>{errorMessage(remove.error)}</Notice>}
      </Modal>
    </section>
  );
}
