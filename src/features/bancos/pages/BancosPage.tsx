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
import { BancoForm } from '../components/BancoForm';
import { BancoFormSkeleton } from '../components/BancoFormSkeleton';
import {
  useBancos,
  useBancoDetail,
  useBancoMutations,
} from '../hooks/useBancos';
import { fieldLabels } from '../schemas/bancoSchema';
import type { Banco, BancoWrite } from '../types/banco';
import { BcraImportDialog } from '../components/BcraImportDialog';
import './bancos.css';

const columns: DataGridColumn<Banco>[] = [
  {
    field: 'id',
    header: 'ID',
    getValue: (row: Banco) => row.id,
    type: 'number' as const,
    initiallyHidden: true,
  },
  ...Object.entries(fieldLabels).map(
    ([field, header]): DataGridColumn<Banco> => ({
      field,
      header,
      getValue: (row) => row[field as keyof BancoWrite],
      initiallyHidden: false,
    }),
  ),
].map((column) => ({
  ...column,
  sortable: false,
  filterable: false,
  searchable: false,
}));
type Editor =
  | { kind: 'create' }
  | { kind: 'edit'; id: number }
  | { kind: 'view'; row: Banco }
  | { kind: 'delete'; row: Banco }
  | null;

export function BancosPage() {
  const permissions = usePermissions();
  useEffect(() => {
    document.title = 'Bancos | Zenthia.LiquidAR.Web';
    if (!permissions.isPending)
      document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [permissions.isPending]);
  const canRead = permissions.can('bancos:read');
  const canWrite = canRead && permissions.can('bancos:write');
  const canDelete = canRead && permissions.can('bancos:delete');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [editor, setEditor] = useState<Editor>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [feedback, setFeedback] = useState('');
  const list = useBancos(pagination.page + 1, pagination.pageSize, canRead);
  const editing = editor?.kind === 'edit';
  const formOpen = editor?.kind === 'create' || editing;
  const detail = useBancoDetail(
    editing ? editor.id : null,
    formOpen && canWrite,
  );
  const { save, remove } = useBancoMutations();
  const busy = save.isPending || remove.isPending;
  useEffect(() => {
    if (list.data && !list.isFetching) {
      const last = Math.max(
        0,
        Math.ceil(list.data.total / pagination.pageSize) - 1,
      );
      if (pagination.page > last) setPagination((p) => ({ ...p, page: last }));
    }
  }, [list.data, list.isFetching, pagination.page, pagination.pageSize]);
  const open = (value: Editor) => {
    save.reset();
    remove.reset();
    setFeedback('');
    setFormVersion((version) => version + 1);
    setEditor(value);
  };
  const close = () => {
    if (!busy) setEditor(null);
  };
  const submit = async (data: BancoWrite, destination: SaveDestination) => {
    if (!canWrite || busy || !formOpen) return;
    try {
      const saved = await save.mutateAsync({
        id: editing ? editor.id : null,
        data,
      });
      setFeedback('El banco se guardó correctamente.');
      setFormVersion((version) => version + 1);
      setEditor(
        destination === 'close'
          ? null
          : destination === 'new'
            ? { kind: 'create' }
            : { kind: 'edit', id: saved.id },
      );
    } catch {
      /* Mutation state renders the normalized error. */
    }
  };
  if (permissions.isPending)
    return (
      <section className="bancos-page">
        <div className="bancos-heading">
          <h1 tabIndex={-1}>Bancos</h1>
        </div>
        <DataGridSkeleton
          columns={3}
          selection
          actions
          label="Cargando permisos…"
        />
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
        <h1 tabIndex={-1}>Bancos</h1>
        <Notice>No tenés permiso para consultar bancos.</Notice>
      </>
    );
  const formError = editing ? detail.error : null;
  const formLoading = editing && (detail.isPending || detail.isFetching);
  return (
    <section className="bancos-page">
      <div className="bancos-heading">
        <h1 tabIndex={-1}>Bancos</h1>
      </div>
      <DataGrid
        label="Bancos"
        rows={list.isError ? [] : (list.data?.items ?? [])}
        columns={columns}
        getRowId={(row) => row.id}
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
        searchUnavailableReason="La API de Bancos todavía no admite búsqueda."
        filtersUnavailableReason="La API de Bancos todavía no admite filtros."
        globalActions={[
          {
            id: 'bcra',
            label: 'Actualizar desde BCRA',
            visible: canWrite,
            onClick: () => setImportOpen(true),
          },
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
        loading={list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => void list.refetch()}
        emptyMessage="No hay bancos para mostrar."
        rowActions={[
          {
            id: 'view',
            label: 'Ver',
            icon: <Icon name="eye" />,
            display: 'icon-text',
            onClick: (row) => open({ kind: 'view', row }),
          },
          {
            id: 'edit',
            label: 'Editar',
            icon: <Icon name="edit" />,
            display: 'icon-text',
            visible: () => canWrite,
            onClick: (row) => open({ kind: 'edit', id: row.id }),
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
      <BcraImportDialog
        open={importOpen && canWrite}
        onClose={() => setImportOpen(false)}
      />
      <Modal
        open={editor?.kind === 'view'}
        title="Ver banco"
        titleIcon={<Icon name="eye" />}
        subtitle="Datos de la entidad bancaria."
        onClose={close}
        cancelButton={{ label: 'Cerrar' }}
        acceptButton={false}
      >
        {editor?.kind === 'view' && (
          <BancoForm
            id="banco-view"
            initial={editor.row}
            busy={false}
            error={null}
            readOnly
          />
        )}
      </Modal>
      <Modal
        open={formOpen && canWrite}
        title={editing ? 'Editar banco' : 'Nuevo banco'}
        titleIcon={<Icon name="edit" />}
        subtitle="Datos de la entidad bancaria."
        onClose={close}
        closeDisabled={busy}
        acceptButton={{
          label: 'Guardar y cerrar',
          type: 'submit',
          form: 'banco-form',
          loading: save.isPending,
          disabled: formLoading || Boolean(formError),
        }}
        cancelButton={{ disabled: busy }}
        actions={
          <FormDialogActions
            form="banco-form"
            busy={busy}
            loading={formLoading}
            hasError={Boolean(formError)}
            onUndo={() => {
              save.reset();
              setFeedback('');
              setFormVersion((version) => version + 1);
              if (editing) void detail.refetch();
            }}
          />
        }
      >
        {feedback && <p role="status">{feedback}</p>}
        {formLoading && !formError && <BancoFormSkeleton />}
        {formError && (
          <>
            <Notice>{errorMessage(formError)}</Notice>
            <Button
              onClick={() => {
                if (editing) void detail.refetch();
              }}
            >
              Reintentar datos
            </Button>
          </>
        )}
        {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
        {!formLoading && !formError && (
          <BancoForm
            key={`${editing ? editor.id : 'new'}-${formVersion}`}
            id="banco-form"
            initial={editing ? detail.data : undefined}
            busy={busy}
            error={save.error}
            onSubmit={submit}
          />
        )}
      </Modal>
      <Modal
        open={editor?.kind === 'delete' && canDelete}
        title="Confirmar eliminación"
        onClose={close}
        closeDisabled={busy}
        acceptButton={{ label: 'Eliminar', loading: remove.isPending }}
        cancelButton={{ disabled: busy }}
        onAccept={async () => {
          if (editor?.kind !== 'delete' || !canDelete || busy) return;
          try {
            await remove.mutateAsync(editor.row.id);
            setFeedback('El banco se eliminó correctamente.');
            setEditor(null);
          } catch {
            /* Render mutation error. */
          }
        }}
      >
        <p>
          ¿Deseás eliminar el banco{' '}
          {editor?.kind === 'delete'
            ? (editor.row.denominacion ?? editor.row.codigoEntidad)
            : ''}
          ?
        </p>
        {remove.isError && <Notice>{errorMessage(remove.error)}</Notice>}
      </Modal>
    </section>
  );
}
