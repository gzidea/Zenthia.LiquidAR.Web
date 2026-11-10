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
import { SindicatoForm } from '../components/SindicatoForm';
import { SindicatoFormSkeleton } from '../components/SindicatoFormSkeleton';
import {
  useSindicatos,
  useSindicatoDetail,
  useProvincias,
  useSindicatoMutations,
} from '../hooks/useSindicatos';
import { fieldLabels } from '../schemas/sindicatoSchema';
import type { Sindicato, SindicatoWrite } from '../types/sindicato';
import './sindicatos.css';

const columns: DataGridColumn<Sindicato>[] = [
  {
    field: 'id',
    header: 'ID',
    getValue: (row: Sindicato) => row.id,
    type: 'number' as const,
    initiallyHidden: true,
  },
  ...Object.entries(fieldLabels).map(
    ([field, header]): DataGridColumn<Sindicato> => ({
      field,
      header,
      getValue: (row) =>
        field === 'idProvincia'
          ? row.provinciaNombre
          : row[field as keyof SindicatoWrite],
      initiallyHidden: ![
        'codigo',
        'nombre',
        'localidad',
        'idProvincia',
        'telefono',
      ].includes(field),
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
  | { kind: 'view'; row: Sindicato }
  | { kind: 'delete'; row: Sindicato }
  | null;

export function SindicatosPage() {
  const permissions = usePermissions();
  useEffect(() => {
    document.title = 'Sindicatos | Zenthia.LiquidAR.Web';
    if (!permissions.isPending)
      document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [permissions.isPending]);
  const canRead = permissions.can('sindicatos:read');
  const canWrite = canRead && permissions.can('sindicatos:write');
  const canDelete = canRead && permissions.can('sindicatos:delete');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [editor, setEditor] = useState<Editor>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [feedback, setFeedback] = useState('');
  const list = useSindicatos(pagination.page + 1, pagination.pageSize, canRead);
  const editing = editor?.kind === 'edit';
  const formOpen = editor?.kind === 'create' || editing;
  const detail = useSindicatoDetail(
    editing ? editor.id : null,
    formOpen && canWrite,
  );
  const provincias = useProvincias(formOpen && canWrite);
  const { save, remove } = useSindicatoMutations();
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
  const submit = async (data: SindicatoWrite, destination: SaveDestination) => {
    if (!canWrite || busy || !formOpen) return;
    try {
      const saved = await save.mutateAsync({
        id: editing ? editor.id : null,
        data,
      });
      setFeedback('El sindicato se guardó correctamente.');
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
      <section className="sindicatos-page">
        <div className="sindicatos-heading">
          <h1 tabIndex={-1}>Sindicatos</h1>
        </div>
        <DataGridSkeleton
          columns={5}
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
        <h1 tabIndex={-1}>Sindicatos</h1>
        <Notice>No tenés permiso para consultar sindicatos.</Notice>
      </>
    );
  const formError = provincias.error ?? (editing ? detail.error : null);
  const formLoading =
    provincias.isPending ||
    (editing && (detail.isPending || detail.isFetching));
  return (
    <section className="sindicatos-page">
      <div className="sindicatos-heading">
        <h1 tabIndex={-1}>Sindicatos</h1>
      </div>
      <DataGrid
        label="Sindicatos"
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
        searchUnavailableReason="La API de Sindicatos todavía no admite búsqueda."
        filtersUnavailableReason="La API de Sindicatos todavía no admite filtros."
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
        loading={list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => void list.refetch()}
        emptyMessage="No hay sindicatos para mostrar."
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
      <Modal
        open={editor?.kind === 'view'}
        title="Ver sindicato"
        titleIcon={<Icon name="eye" />}
        subtitle="Datos generales, contacto y aportes."
        onClose={close}
        cancelButton={{ label: 'Cerrar' }}
        acceptButton={false}
      >
        {editor?.kind === 'view' && (
          <SindicatoForm
            id="sindicato-view"
            initial={editor.row}
            provincias={
              editor.row.idProvincia == null
                ? []
                : [
                    {
                      id: editor.row.idProvincia,
                      nombre: editor.row.provinciaNombre,
                    },
                  ]
            }
            busy={false}
            error={null}
            readOnly
          />
        )}
      </Modal>
      <Modal
        open={formOpen && canWrite}
        title={editing ? 'Editar sindicato' : 'Nuevo sindicato'}
        titleIcon={<Icon name="edit" />}
        subtitle="Datos generales, contacto y aportes."
        onClose={close}
        closeDisabled={busy}
        acceptButton={{
          label: 'Guardar y cerrar',
          type: 'submit',
          form: 'sindicato-form',
          loading: save.isPending,
          disabled: formLoading || Boolean(formError),
        }}
        cancelButton={{ disabled: busy }}
        actions={
          <FormDialogActions
            form="sindicato-form"
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
        {formLoading && !formError && <SindicatoFormSkeleton />}
        {formError && (
          <>
            <Notice>{errorMessage(formError)}</Notice>
            <Button
              onClick={() => {
                void provincias.refetch();
                if (editing) void detail.refetch();
              }}
            >
              Reintentar datos
            </Button>
          </>
        )}
        {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
        {!formLoading && !formError && (
          <SindicatoForm
            key={`${editing ? editor.id : 'new'}-${formVersion}`}
            id="sindicato-form"
            initial={editing ? detail.data : undefined}
            provincias={provincias.data ?? []}
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
            setFeedback('El sindicato se eliminó correctamente.');
            setEditor(null);
          } catch {
            /* Render mutation error. */
          }
        }}
      >
        <p>
          ¿Deseás eliminar el sindicato{' '}
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
