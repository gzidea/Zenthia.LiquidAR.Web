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
import { ObraSocialForm } from '../components/ObraSocialForm';
import { ObraSocialFormSkeleton } from '../components/ObraSocialFormSkeleton';
import {
  useObrasSociales,
  useObraSocialDetail,
  useObraSocialProvincias,
  useObraSocialMutations,
} from '../hooks/useObrasSociales';
import { fieldLabels } from '../schemas/obraSocialSchema';
import type { ObraSocial, ObraSocialWrite } from '../types/obraSocial';
import './obras-sociales.css';

const initialColumns = ['codigo', 'nombre', 'email', 'telefono'];
const columns: DataGridColumn<ObraSocial>[] = [
  {
    field: 'id',
    header: 'ID',
    getValue: (row: ObraSocial) => row.id,
    type: 'number' as const,
    initiallyHidden: true,
  },
  ...Object.entries(fieldLabels).map(
    ([field, header]): DataGridColumn<ObraSocial> => ({
      field,
      header,
      getValue: (row) =>
        field === 'idProvincia'
          ? row.provinciaNombre
          : row[field as keyof ObraSocialWrite],
      initiallyHidden: !initialColumns.includes(field),
    }),
  ),
  {
    field: 'localidad',
    header: 'Localidad',
    getValue: (row: ObraSocial) => row.localidad,
    initiallyHidden: true,
  },
].map((column) => ({
  ...column,
  sortable: false,
  filterable: false,
  searchable: false,
}));
type Editor =
  | { kind: 'create' }
  | { kind: 'edit'; id: number }
  | { kind: 'view'; row: ObraSocial }
  | { kind: 'delete'; row: ObraSocial }
  | null;

export function ObrasSocialesPage() {
  const permissions = usePermissions();
  useEffect(() => {
    document.title = 'Obras Sociales | Zenthia.LiquidAR.Web';
    if (!permissions.isPending)
      document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [permissions.isPending]);
  const canRead = permissions.can('obrassociales:read');
  const canWrite = canRead && permissions.can('obrassociales:write');
  const canDelete = canRead && permissions.can('obrassociales:delete');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [editor, setEditor] = useState<Editor>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [feedback, setFeedback] = useState('');
  const list = useObrasSociales(
    pagination.page + 1,
    pagination.pageSize,
    canRead,
  );
  const editing = editor?.kind === 'edit';
  const formOpen = editor?.kind === 'create' || editing;
  const detail = useObraSocialDetail(
    editing ? editor.id : null,
    formOpen && canWrite,
  );
  const provincias = useObraSocialProvincias(formOpen && canWrite);
  const { save, remove } = useObraSocialMutations();
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
  const submit = async (
    data: ObraSocialWrite,
    destination: SaveDestination,
  ) => {
    if (!canWrite || busy || !formOpen) return;
    try {
      const saved = await save.mutateAsync({
        id: editing ? editor.id : null,
        data,
      });
      setFeedback('La obra social se guardó correctamente.');
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
      <section className="obras-sociales-page">
        <div className="obras-sociales-heading">
          <h1 tabIndex={-1}>Obras Sociales</h1>
        </div>
        <DataGridSkeleton
          columns={initialColumns.length}
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
        <h1 tabIndex={-1}>Obras Sociales</h1>
        <Notice>No tenés permiso para consultar obras sociales.</Notice>
      </>
    );
  const formError = provincias.error ?? (editing ? detail.error : null);
  const formLoading =
    provincias.isPending ||
    (editing && (detail.isPending || detail.isFetching));
  return (
    <section className="obras-sociales-page">
      <div className="obras-sociales-heading">
        <h1 tabIndex={-1}>Obras Sociales</h1>
      </div>
      <DataGrid
        label="Obras Sociales"
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
        initialState={{ columnOrder: initialColumns }}
        searchDisabled
        filterButtonDisabled
        searchUnavailableReason="La API de Obras Sociales todavía no admite búsqueda."
        filtersUnavailableReason="La API de Obras Sociales todavía no admite filtros."
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
        emptyMessage="No hay obras sociales para mostrar."
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
      {feedback && !formOpen && (
        <p role="status" className="obra-social-page-feedback">
          {feedback}
        </p>
      )}
      <Modal
        open={editor?.kind === 'view'}
        title="Ver obra social"
        titleIcon={<Icon name="eye" />}
        subtitle="Datos generales, contacto y aportes."
        onClose={close}
        cancelButton={{ label: 'Cerrar' }}
        acceptButton={false}
      >
        {editor?.kind === 'view' && (
          <ObraSocialForm
            id="obra-social-view"
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
        title={editing ? 'Editar obra social' : 'Nueva obra social'}
        titleIcon={<Icon name="edit" />}
        subtitle="Datos generales, contacto y aportes."
        onClose={close}
        closeDisabled={busy}
        acceptButton={{
          label: 'Guardar y cerrar',
          type: 'submit',
          form: 'obra-social-form',
          loading: save.isPending,
          disabled: formLoading || Boolean(formError),
        }}
        cancelButton={{ disabled: busy }}
        actions={
          <FormDialogActions
            form="obra-social-form"
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
        {formLoading && !formError && <ObraSocialFormSkeleton />}
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
          <ObraSocialForm
            key={`${editing ? editor.id : 'new'}-${formVersion}`}
            id="obra-social-form"
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
            setFeedback('La obra social se eliminó correctamente.');
            setEditor(null);
          } catch {
            /* Render mutation error. */
          }
        }}
      >
        <p>
          ¿Deseás eliminar la obra social{' '}
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
