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
import { EmpresaForm } from '../components/EmpresaForm';
import { EmpresaFormSkeleton } from '../components/EmpresaFormSkeleton';
import { CostosPolizaDialog } from '../components/CostosPolizaDialog';
import {
  useEmpresas,
  useEmpresaDetail,
  useEmpresaCatalogos,
  useEmpresaMutations,
} from '../hooks/useEmpresas';
import type { Empresa, EmpresaCompletaWrite } from '../types/empresa';
import './empresas.css';

const columns: DataGridColumn<Empresa>[] = [
  { field: 'codigo', header: 'Código', getValue: (row: Empresa) => row.codigo },
  { field: 'nombre', header: 'Nombre', getValue: (row: Empresa) => row.nombre },
  {
    field: 'claveUnica',
    header: 'Clave única',
    getValue: (row: Empresa) => row.claveUnica,
  },
  {
    field: 'telefono',
    header: 'Teléfono',
    getValue: (row: Empresa) => row.telefono,
  },
  {
    field: 'email',
    header: 'Email',
    getValue: (row: Empresa) => row.email,
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
  | { kind: 'edit' | 'view'; id: number }
  | { kind: 'delete'; row: Empresa }
  | null;
const emptyCatalogos = { provincias: [], tiposClave: [], tiposEmpresa: [] };

export function EmpresasPage() {
  const permissions = usePermissions();
  const canRead = permissions.can('empresas:read');
  const canWrite = canRead && permissions.can('empresas:write');
  const canDelete = canRead && permissions.can('empresas:delete');
  const canAuxiliar = permissions.can('auxiliar:read');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [editor, setEditor] = useState<Editor>(null);
  const [version, setVersion] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [costosEmpresa, setCostosEmpresa] = useState<Empresa | null>(null);
  const list = useEmpresas(pagination.page + 1, pagination.pageSize, canRead);
  const editing = editor?.kind === 'edit';
  const viewing = editor?.kind === 'view';
  const formOpen = editor?.kind === 'create' || editing || viewing;
  const detail = useEmpresaDetail(
    editing || viewing ? editor.id : null,
    formOpen && canRead,
  );
  const catalogos = useEmpresaCatalogos(formOpen && canRead && canAuxiliar);
  const { save, remove } = useEmpresaMutations();
  const busy = save.isPending || remove.isPending;
  const formError =
    (canAuxiliar ? catalogos.error : null) ??
    (editing || viewing ? detail.error : null);
  const formLoading =
    (canAuxiliar && catalogos.isPending) ||
    ((editing || viewing) && (detail.isPending || detail.isFetching));
  useEffect(() => {
    document.title = 'Empresas | Zenthia.LiquidAR.Web';
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
  const submit = async (
    data: EmpresaCompletaWrite,
    destination: SaveDestination,
  ) => {
    if (!canWrite || busy || !formOpen || viewing) return;
    try {
      const saved = await save.mutateAsync({
        id: editing ? editor.id : null,
        data,
      });
      setFeedback('La empresa se guardó correctamente.');
      setVersion((v) => v + 1);
      setEditor(
        destination === 'close'
          ? null
          : destination === 'new'
            ? { kind: 'create' }
            : { kind: 'edit', id: saved.empresa.id },
      );
    } catch {
      /* Keep the draft; the mutation exposes the error. */
    }
  };
  if (permissions.isPending)
    return (
      <section>
        <h1 tabIndex={-1}>Empresas</h1>
        <DataGridSkeleton
          columns={4}
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
        <h1 tabIndex={-1}>Empresas</h1>
        <Notice>No tenés permiso para consultar empresas.</Notice>
      </>
    );
  return (
    <section className="empresas-page">
      <h1 tabIndex={-1}>Empresas</h1>
      <DataGrid
        label="Empresas"
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
        searchUnavailableReason="La API de Empresas todavía no admite búsqueda."
        filtersUnavailableReason="La API de Empresas todavía no admite filtros."
        loading={list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => void list.refetch()}
        emptyMessage="No hay empresas para mostrar."
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
            id: 'costos-poliza',
            label: 'Emisión y renovación SCVO',
            onClick: (row) => setCostosEmpresa(row),
          },
          {
            id: 'view',
            label: 'Ver',
            icon: <Icon name="eye" />,
            display: 'icon-text',
            onClick: (row) => open({ kind: 'view', id: row.id }),
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
      {costosEmpresa && (
        <CostosPolizaDialog
          empresa={costosEmpresa}
          canWrite={canWrite}
          onClose={() => setCostosEmpresa(null)}
        />
      )}
      <Modal
        open={formOpen && (viewing || canWrite)}
        size="large"
        title={
          viewing ? 'Ver empresa' : editing ? 'Editar empresa' : 'Nueva empresa'
        }
        titleIcon={<Icon name={viewing ? 'eye' : 'edit'} />}
        subtitle="Datos generales, actividades, contactos y bancos."
        onClose={close}
        closeDisabled={busy}
        acceptButton={
          viewing
            ? false
            : {
                label: 'Guardar y cerrar',
                type: 'submit',
                form: 'empresa-form',
                loading: save.isPending,
                disabled: formLoading || Boolean(formError),
              }
        }
        cancelButton={{
          label: viewing ? 'Cerrar' : 'Cancelar',
          disabled: busy,
        }}
        actions={
          viewing ? undefined : (
            <FormDialogActions
              form="empresa-form"
              busy={busy}
              loading={formLoading}
              hasError={Boolean(formError)}
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
        {formLoading && !formError && <EmpresaFormSkeleton />}
        {formError && (
          <>
            <Notice>{errorMessage(formError)}</Notice>
            <Button
              onClick={() => {
                if (canAuxiliar) void catalogos.refetch();
                if (editing || viewing) void detail.refetch();
              }}
            >
              Reintentar datos
            </Button>
          </>
        )}
        {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
        {!canAuxiliar && !viewing && (
          <p>
            No tenés acceso a los catálogos auxiliares. Se conservan las
            referencias actuales; podés completar los demás datos.
          </p>
        )}
        {!formLoading && !formError && (
          <EmpresaForm
            key={`${editing || viewing ? editor.id : 'new'}-${version}`}
            id="empresa-form"
            initial={editing || viewing ? detail.data : undefined}
            catalogos={catalogos.data ?? emptyCatalogos}
            busy={busy}
            error={save.error}
            readOnly={viewing}
            canDelete={canDelete}
            canReadActivities={canAuxiliar}
            canReadBanks={permissions.can('bancos:read')}
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
          if (editor?.kind !== 'delete' || busy || !canDelete) return;
          try {
            await remove.mutateAsync(editor.row.id);
            setFeedback('La empresa se eliminó correctamente.');
            setEditor(null);
          } catch {
            /* Render normalized error. */
          }
        }}
      >
        <p>
          ¿Deseás eliminar la empresa{' '}
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
