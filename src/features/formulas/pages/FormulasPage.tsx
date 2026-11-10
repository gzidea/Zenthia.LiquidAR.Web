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
import { FormulaForm, FormulaFormSkeleton } from '../components/FormulaForm';
import { FormulaOrderDialog } from '../components/FormulaOrderDialog';
import {
  useFormulas,
  useFormulaDetail,
  useFormulaMutations,
  useFormulaCatalog,
} from '../hooks/useFormulas';
import { catalogLabel } from '../types/formula';
import type { Formula, FormulaWrite, Filtros } from '../types/formula';
import './formulas.css';
import { PublicarCentralDialog } from '@/features/formulas-empresa/PublicarCentralDialog';
const columnFields = {
  convenioNombre: 'Convenio',
  codigo: 'Código',
  descripcionCompleta: 'Descripción completa',
  conceptoDescripcion: 'Concepto',
  unidadDescripcion: 'Unidad',
  activo: 'Activo',
  visible: 'Visible',
  orden: 'Orden',
  formulaCantidad: 'Cantidad',
  formulaBase: 'Base',
  formulaImporte: 'Importe',
  variable: 'Variable',
  codigoAfip: 'Código AFIP',
  vigenteDesde: 'Vigente desde',
  vigenteHasta: 'Vigente hasta',
} as const;
const columns: DataGridColumn<Formula>[] = Object.entries(columnFields).map(
  ([field, header]) => ({
    field,
    header,
    getValue: (r: Formula) => {
      const value = r[field as keyof typeof columnFields];
      return typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value;
    },
    sortable: false,
    filterable: false,
    searchable: false,
  }),
);
type Editor =
  | { kind: 'create' }
  | { kind: 'edit' | 'view'; id: number }
  | { kind: 'delete'; row: Formula }
  | null;
export function FormulasPage() {
  const [publicarId, setPublicarId] = useState<number | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<
    Readonly<Record<string, boolean>>
  >({
    formulaCantidad: false,
    formulaBase: false,
    formulaImporte: false,
    variable: false,
    codigoAfip: false,
    vigenteDesde: false,
    vigenteHasta: false,
  });
  const permissions = usePermissions();
  const canRead = permissions.can('formulas:read');
  const canWrite =
    canRead &&
    permissions.can('formulas:write') &&
    Boolean(permissions.data?.isSuperAdmin);
  // Published formula history is preserved; the active model has no physical deletion.
  const canDelete = false;
  const convenios = useFormulaCatalog(
    'convenios',
    canRead && permissions.can('convenios:read'),
  );
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [editor, setEditor] = useState<Editor>(null);
  const [version, setVersion] = useState(0);
  const [organizing, setOrganizing] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [filtros, setFiltros] = useState<Filtros>({
    buscar: '',
    convenioId: '',
    activo: '',
  });
  const list = useFormulas(
    pagination.page + 1,
    pagination.pageSize,
    filtros,
    canRead,
  );
  const editing = editor?.kind === 'edit';
  const viewing = editor?.kind === 'view';
  const formOpen = editing || viewing || editor?.kind === 'create';
  const detail = useFormulaDetail(
    editing || viewing ? editor.id : null,
    formOpen && canRead,
  );
  const { save, remove, duplicate, exportar } = useFormulaMutations();
  const busy = save.isPending || remove.isPending || duplicate.isPending;
  const loading =
    (editing || viewing) && (detail.isPending || detail.isFetching);
  const formError = editing || viewing ? detail.error : null;
  useEffect(() => {
    document.title = 'Formulas | Zenthia.LiquidAR.Web';
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
    duplicate.reset();
    setFeedback('');
    setVersion((v) => v + 1);
    setEditor(value);
  };
  const close = () => {
    if (!busy) setEditor(null);
  };
  const submit = async (
    data: FormulaWrite,
    destination: SaveDestination,
    clone: boolean,
  ) => {
    if (!canWrite || busy || viewing || !formOpen) return;
    try {
      const saved = await save.mutateAsync({
        id: editing ? editor.id : null,
        data,
        clone,
      });
      setFeedback(
        clone
          ? 'Se guardó el original y se abrió la copia.'
          : 'La fórmula se guardó correctamente.',
      );
      setVersion((v) => v + 1);
      setEditor(
        !clone && destination === 'close'
          ? null
          : !clone && destination === 'new'
            ? { kind: 'create' }
            : { kind: 'edit', id: saved.formula.id },
      );
    } catch {
      /* Keep draft and show mutation error. */
    }
  };
  if (permissions.isPending)
    return (
      <section>
        <h1 tabIndex={-1}>Fórmulas</h1>
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
        <h1 tabIndex={-1}>Fórmulas</h1>
        <Notice>No tenés permiso para consultar fórmulas.</Notice>
      </>
    );
  return (
    <section className="formulas-page">
      <h1 tabIndex={-1}>Fórmulas</h1>
      <div className="formula-filters">
        <label>
          Buscar código o descripción
          <input
            value={filtros.buscar}
            onChange={(e) => {
              setFiltros((f) => ({ ...f, buscar: e.target.value }));
              setPagination((p) => ({ ...p, page: 0 }));
            }}
          />
        </label>
        <label>
          Convenio
          <Select
            disabled={
              !permissions.can('convenios:read') ||
              convenios.isFetching ||
              convenios.isError
            }
            value={filtros.convenioId}
            onChange={(e) => {
              setFiltros((f) => ({ ...f, convenioId: e.target.value }));
              setPagination((p) => ({ ...p, page: 0 }));
            }}
          >
            <option value="">Todos</option>
            {convenios.data?.map((x) => (
              <option key={x.id} value={x.id}>
                {catalogLabel(x)}
              </option>
            ))}
          </Select>
        </label>
        {!permissions.can('convenios:read') && (
          <small>Sin permiso para filtrar por catálogo de convenios.</small>
        )}
        {convenios.isError && (
          <Button onClick={() => void convenios.refetch()}>
            Reintentar convenios
          </Button>
        )}
        <label>
          Estado
          <Select
            value={filtros.activo}
            onChange={(e) => {
              setFiltros((f) => ({ ...f, activo: e.target.value }));
              setPagination((p) => ({ ...p, page: 0 }));
            }}
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </Select>
        </label>
      </div>
      {(duplicate.isError || exportar.isError) && (
        <Notice>{errorMessage(duplicate.error ?? exportar.error)}</Notice>
      )}
      <DataGrid
        label="Fórmulas"
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
        emptyMessage="No hay fórmulas para mostrar."
        globalActions={[
          {
            id: 'refresh',
            label: 'Refrescar',
            disabled: list.isFetching,
            onClick: () => void list.refetch(),
          },
          {
            id: 'export',
            label: 'Exportar XLSX',
            disabled: exportar.isPending,
            onClick: () => exportar.mutate(filtros),
          },
          {
            id: 'order',
            label: 'Organizar orden',
            visible: canWrite,
            disabled: busy || !filtros.convenioId || list.isFetching,
            onClick: () => {
              if (filtros.convenioId) setOrganizing(Number(filtros.convenioId));
            },
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
            id: 'publish',
            label: 'Publicar versión',
            visible: () => canWrite,
            onClick: (row) => setPublicarId(row.id),
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
            id: 'duplicate',
            label: 'Duplicar',
            visible: () => canWrite,
            disabled: () => busy,
            onClick: async (r) => {
              try {
                const copy = await duplicate.mutateAsync(r.id);
                open({ kind: 'edit', id: copy.id });
                setFeedback('Copia creada con Base y sin asociaciones.');
              } catch {
                /* Preserve error. */
              }
            },
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
      {canWrite && (
        <p>
          Los cambios del catálogo se utilizan al publicar una versión con
          vigencia.
        </p>
      )}
      {publicarId !== null && (
        <PublicarCentralDialog
          id={publicarId}
          onClose={() => setPublicarId(null)}
        />
      )}
      {canWrite && !filtros.convenioId && (
        <small>Seleccioná un convenio para organizar sus fórmulas.</small>
      )}
      {organizing !== null && canWrite && (
        <FormulaOrderDialog
          convenioId={organizing}
          convenioNombre={catalogLabel(
            convenios.data?.find((x) => x.id === organizing) ?? {
              id: organizing,
            },
          )}
          onClose={() => setOrganizing(null)}
          onSaved={() => {
            setOrganizing(null);
            setPagination((p) => ({ ...p, page: 0 }));
            setFeedback('El orden de las fórmulas se guardó correctamente.');
          }}
        />
      )}
      <Modal
        open={formOpen && (viewing || canWrite)}
        size="large"
        title={
          viewing ? 'Ver fórmula' : editing ? 'Editar fórmula' : 'Nueva fórmula'
        }
        titleIcon={<Icon name={viewing ? 'eye' : 'edit'} />}
        subtitle="Expresiones, períodos y tipos de liquidación."
        onClose={close}
        closeDisabled={busy}
        acceptButton={
          viewing
            ? false
            : {
                label: 'Guardar y cerrar',
                type: 'submit',
                form: 'formula-form',
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
              form="formula-form"
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
        {loading && !formError && <FormulaFormSkeleton />}
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
          <FormulaForm
            key={`${editing || viewing ? editor.id : 'new'}-${version}`}
            initial={editing || viewing ? detail.data : undefined}
            busy={busy}
            readOnly={viewing}
            canDelete={canDelete}
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
            setFeedback('La fórmula se eliminó correctamente.');
            setEditor(null);
          } catch {
            /* Show normalized error. */
          }
        }}
      >
        <p>
          ¿Deseás eliminar la fórmula{' '}
          {editor?.kind === 'delete'
            ? (editor.row.descripcion ?? editor.row.codigo ?? editor.row.id)
            : ''}
          ?
        </p>
        {remove.isError && <Notice>{errorMessage(remove.error)}</Notice>}
      </Modal>
    </section>
  );
}
