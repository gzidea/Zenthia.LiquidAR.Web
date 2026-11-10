import { SegurosDialog } from '@/features/seguros/SegurosDialog';
import { Select } from '@/components/ui/Select';
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
import { LegajoForm, LegajoFormSkeleton } from '../components/LegajoForm';
import {
  useLegajos,
  useLegajo,
  useLegajoMutations,
  useCatalogo,
} from '../hooks/useLegajos';
import type { Legajo, Write } from '../types/legajo';
import './legajos.css';
const columns: DataGridColumn<Legajo>[] = [
  { field: 'legajo', header: 'Legajo', getValue: (r: Legajo) => r.legajo },
  {
    field: 'nombre',
    header: 'Apellido y nombre',
    getValue: (r: Legajo) => `${r.apellidos ?? ''}, ${r.nombres ?? ''}`,
  },
  { field: 'cuil', header: 'CUIL', getValue: (r: Legajo) => r.cuil },
  {
    field: 'empresa',
    header: 'Empresa',
    getValue: (r: Legajo) => r.empresaNombre ?? r.idEmpresa,
  },
  {
    field: 'convenio',
    header: 'Convenio',
    getValue: (r: Legajo) => r.convenioNombre ?? r.idConvenio,
  },
  {
    field: 'categoria',
    header: 'Categoría',
    getValue: (r: Legajo) => r.categoriaNombre ?? r.idCategoria,
  },
  {
    field: 'fechaIngreso',
    header: 'Fecha de ingreso',
    getValue: (r: Legajo) => r.fechaIngreso?.slice(0, 10),
  },
  {
    field: 'fechaEgreso',
    header: 'Fecha de egreso',
    getValue: (r: Legajo) => r.fechaEgreso?.slice(0, 10),
  },
].map((c) => ({ ...c, sortable: false, filterable: false, searchable: false }));
type Editor =
  | { kind: 'create' }
  | { kind: 'edit' | 'view'; id: number }
  | { kind: 'delete'; row: Legajo }
  | null;
export function LegajosPage() {
  const [columnVisibility, setColumnVisibility] = useState<
    Readonly<Record<string, boolean>>
  >({
    fechaEgreso: false,
  });
  const permissions = usePermissions();
  const canRead = permissions.can('legajo:read');
  const canWrite = canRead && permissions.can('legajo:write');
  const canDelete = canRead && permissions.can('legajo:write');
  const empresas = useCatalogo('empresas', undefined, canRead);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [seguroLegajo, setSeguroLegajo] = useState<Legajo | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [version, setVersion] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [filtros, setFiltros] = useState({
    buscar: '',
    empresaId: '',
  });
  const list = useLegajos(
    pagination.page + 1,
    pagination.pageSize,
    filtros.buscar,
    filtros.empresaId,
    canRead,
  );
  const editing = editor?.kind === 'edit';
  const viewing = editor?.kind === 'view';
  const formOpen = editing || viewing || editor?.kind === 'create';
  const detail = useLegajo((editing || viewing) && canRead ? editor.id : null);
  const { save, remove } = useLegajoMutations();
  const busy = save.isPending || remove.isPending;
  const loading =
    (editing || viewing) && (detail.isPending || detail.isFetching);
  const formError = editing || viewing ? detail.error : null;
  useEffect(() => {
    document.title = 'Legajos | Zenthia.LiquidAR.Web';
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
  const submit = async (data: Write, destination: SaveDestination) => {
    if (!canWrite || busy || viewing || !formOpen) return;
    try {
      const saved = await save.mutateAsync({
        id: editing ? editor.id : null,
        data,
      });
      setFeedback('El legajo se guardó correctamente.');
      setVersion((v) => v + 1);
      setEditor(
        destination === 'close'
          ? null
          : destination === 'new'
            ? { kind: 'create' }
            : { kind: 'edit', id: saved.legajo.id },
      );
    } catch {
      /* Keep draft and show mutation error. */
    }
  };
  if (permissions.isPending)
    return (
      <section>
        <h1 tabIndex={-1}>Legajos</h1>
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
        <h1 tabIndex={-1}>Legajos</h1>
        <Notice>No tenés permiso para consultar legajos.</Notice>
      </>
    );
  return (
    <section className="legajos-page">
      {seguroLegajo && (
        <SegurosDialog
          kind="legajo"
          id={seguroLegajo.id}
          nombre={`${seguroLegajo.apellidos ?? ''} ${seguroLegajo.nombres ?? ''}`}
          canWrite={canWrite}
          onClose={() => setSeguroLegajo(null)}
        />
      )}

      <h1 tabIndex={-1}>Legajos</h1>
      <div className="legajo-filters">
        <div className="field">
          <label htmlFor="buscar-legajo">Buscar legajo, nombre o CUIL</label>
          <input
            id="buscar-legajo"
            value={filtros.buscar}
            onChange={(e) => {
              setFiltros((f) => ({ ...f, buscar: e.target.value }));
              setPagination((p) => ({ ...p, page: 0 }));
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="empresa-filtro">Empresa</label>
          <Select
            id="empresa-filtro"
            value={filtros.empresaId}
            disabled={empresas.isPending || empresas.isError}
            onChange={(e) => {
              setFiltros((f) => ({ ...f, empresaId: e.target.value }));
              setPagination((p) => ({ ...p, page: 0 }));
            }}
          >
            <option value="">Todas</option>
            {empresas.data?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre ?? x.id}
              </option>
            ))}
          </Select>
        </div>
        {empresas.isError && (
          <Button onClick={() => void empresas.refetch()}>
            Reintentar empresas
          </Button>
        )}
      </div>
      <DataGrid
        label="Legajos"
        rows={list.isError ? [] : (list.data?.items ?? [])}
        columns={columns}
        columnVisibilityModel={columnVisibility}
        onColumnVisibilityModelChange={setColumnVisibility}
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
        showSearch={false}
        showFilterButton={false}
        loading={list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => void list.refetch()}
        emptyMessage="No hay legajos para mostrar."
        globalActions={[
          {
            id: 'refresh',
            label: 'Refrescar',
            disabled: list.isFetching,
            onClick: () => void list.refetch(),
          },
          {
            id: 'create',
            disabled: busy,
            label: 'Nuevo',
            icon: <Icon name="plus" />,
            display: 'icon-text',
            visible: canWrite,
            onClick: () => open({ kind: 'create' }),
          },
        ]}
        rowActions={[
          {
            id: 'seguros',
            label: 'Cobertura SCVO',
            onClick: (row) => setSeguroLegajo(row),
          },
          {
            id: 'view',
            disabled: () => busy,
            label: 'Ver',
            icon: <Icon name="eye" />,
            display: 'icon-text',
            onClick: (r) => open({ kind: 'view', id: r.id }),
          },
          {
            id: 'edit',
            disabled: () => busy,
            label: 'Editar',
            icon: <Icon name="edit" />,
            display: 'icon-text',
            visible: () => canWrite,
            onClick: (r) => open({ kind: 'edit', id: r.id }),
          },
          {
            id: 'delete',
            disabled: () => busy,
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
          viewing ? 'Ver legajo' : editing ? 'Editar legajo' : 'Nuevo legajo'
        }
        titleIcon={<Icon name={viewing ? 'eye' : 'edit'} />}
        subtitle="Datos personales, laborales, conceptos particulares y SICOSS."
        onClose={close}
        closeDisabled={busy}
        acceptButton={
          viewing
            ? false
            : {
                label: 'Guardar y cerrar',
                type: 'submit',
                form: 'legajo-form',
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
              form="legajo-form"
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
        {loading && !formError && <LegajoFormSkeleton />}
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
          <LegajoForm
            key={`${editing || viewing ? editor.id : 'new'}-${version}`}
            initial={editing || viewing ? detail.data : undefined}
            busy={busy}
            readOnly={viewing}
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
          if (editor?.kind !== 'delete' || busy || !canDelete) return;
          try {
            await remove.mutateAsync(editor.row.id);
            setFeedback('El legajo se eliminó correctamente.');
            setEditor(null);
          } catch {
            /* Show normalized error. */
          }
        }}
      >
        <p>
          ¿Deseás eliminar el legajo{' '}
          {editor?.kind === 'delete'
            ? (editor.row.apellidos ?? editor.row.legajo ?? editor.row.id)
            : ''}
          ?
        </p>
        {remove.isError && <Notice>{errorMessage(remove.error)}</Notice>}
      </Modal>
    </section>
  );
}
