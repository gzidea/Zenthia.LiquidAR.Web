import { Select } from '@/components/ui/Select';
import { useEffect, useRef, useState } from 'react';
import { DataGrid, type DataGridColumn } from '@/components/ui/DataGrid';
import { Modal } from '@/components/ui/Modal';
import {
  FormDialogActions,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { DataGridSkeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { SelectionSearch } from '@/components/ui/SelectionSearch';
import { ApiError, errorMessage } from '@/services/http/ApiError';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import {
  useGuardarRegla,
  useHistorial,
  useRegla,
  useReglas,
  useVersion,
  useRevisarRegla,
  useProgramadas,
} from './hooks';
import { ReglaForm, ReglaFormSkeleton } from './ReglaForm';
import {
  currentMonth,
  estados,
  operaciones,
  periodoTexto,
  type Regla,
  type ReglaWrite,
  type Version,
} from './types';
import './reglas.css';
type Editor = {
  id: number | null;
  kind: 'create' | 'edit' | 'view' | 'deactivate';
  versionId?: number;
};
const columns: DataGridColumn<Regla>[] = [
  {
    field: 'nombre',
    header: 'Nombre',
    width: 200,
    getValue: (x: Regla) => x.nombre,
  },
  {
    field: 'revisionActual',
    header: 'Última revisión',
    width: 100,
    getValue: (x: Regla) => x.revisionActual,
  },
  {
    field: 'revisionPeriodo',
    header: 'Revisión del período',
    width: 120,
    getValue: (x: Regla) => x.versionPeriodo?.revision ?? '—',
  },
  {
    field: 'vigencia',
    header: 'Vigencia',
    width: 180,
    getValue: (x: Regla) =>
      x.versionPeriodo
        ? `${periodoTexto(x.versionPeriodo.periodoDesde)} — ${periodoTexto(x.versionPeriodo.periodoHasta)}`
        : '—',
  },
  {
    field: 'estado',
    header: 'Estado en el período',
    width: 140,
    getValue: (x: Regla) => estados[x.estado ?? ''] ?? '—',
  },
  {
    field: 'operacion',
    header: 'Operación',
    initiallyHidden: true,
    getValue: (x: Regla) =>
      operaciones[x.versionPeriodo?.tipoAjuste ?? ''] ?? '—',
  },
].map((c) => ({ ...c, sortable: false, filterable: false, searchable: false }));
const historyColumns: DataGridColumn<Version>[] = [
  {
    field: 'revision',
    header: 'Revisión',
    width: 80,
    minWidth: 70,
    getValue: (x: Version) => x.revision,
  },
  {
    field: 'desde',
    header: 'Desde',
    width: 100,
    minWidth: 90,
    getValue: (x: Version) => periodoTexto(x.periodoDesde),
  },
  {
    field: 'hasta',
    header: 'Hasta',
    width: 100,
    minWidth: 90,
    getValue: (x: Version) => periodoTexto(x.periodoHasta),
  },
  {
    field: 'activa',
    header: 'Estado publicado',
    width: 120,
    getValue: (x: Version) => (x.activa ? 'Activa' : 'Inactiva'),
  },
  {
    field: 'ajuste',
    header: 'Operación',
    width: 170,
    getValue: (x: Version) => operaciones[x.ajuste.tipo],
  },
  {
    field: 'motivo',
    header: 'Motivo',
    width: 160,
    getValue: (x: Version) => x.motivo,
  },
  {
    field: 'fecha',
    header: 'Publicada',
    initiallyHidden: true,
    getValue: (x: Version) => new Date(x.creadoEn).toLocaleString('es-AR'),
  },
  {
    field: 'usuario',
    header: 'Usuario',
    initiallyHidden: true,
    getValue: (x: Version) => x.creadoPorUserId,
  },
].map((c) => ({ ...c, sortable: false, filterable: false, searchable: false }));
export function ReglasPage() {
  const permissions = usePermissions();
  const [nuevaCentral, setNuevaCentral] = useState(false);
  const canRead = permissions.can('reglas-ajustes:read');
  const canWrite = canRead && permissions.can('reglas-ajustes:write');
  const puedeEditar = (r: Regla) =>
    canWrite && (!r.centralizada || permissions.data?.isSuperAdmin === true);
  const [filters, setFilters] = useState({
    buscar: '',
    periodo: currentMonth(),
    estado: '',
  });
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [history, setHistory] = useState<Regla | null>(null);
  const [historyPage, setHistoryPage] = useState({ page: 0, pageSize: 25 });
  const [review, setReview] = useState<Version | null>(null);
  const [acceptedRevision, setAcceptedRevision] = useState<number | null>(null);
  const locked = useRef(false);
  const list = useReglas(
    pagination.page + 1,
    pagination.pageSize,
    filters,
    canRead,
  );
  const detail = useRegla(editor?.id ?? null, canRead && !!editor);
  const selected = useVersion(
    editor?.id ?? null,
    editor?.versionId ?? null,
    canRead && !!editor,
  );
  const versions = useHistorial(
    history?.id ?? null,
    historyPage.page + 1,
    canRead && !!history,
  );
  const save = useGuardarRegla();
  const revisar = useRevisarRegla();
  const programadas = useProgramadas(
    editor?.id ?? null,
    editor?.kind === 'deactivate',
  );
  const busy = save.isPending;
  const loading =
    !!editor?.id &&
    (detail.isPending ||
      detail.isFetching ||
      (editor.kind === 'deactivate' &&
        (programadas.isPending || programadas.isFetching)) ||
      (!!editor.versionId && (selected.isPending || selected.isFetching)));
  const loadError =
    (editor?.kind === 'deactivate' ? programadas.error : null) ??
    detail.error ??
    (editor?.versionId ? selected.error : null);
  const initial = editor?.versionId
    ? selected.data
    : detail.data?.ultimaVersion;
  const name = detail.data?.regla.nombre ?? '';
  const readonly =
    editor?.kind === 'view' ||
    Boolean(detail.data?.regla.centralizada && !permissions.data?.isSuperAdmin);
  useEffect(() => {
    document.title = 'Reglas de ajuste | Zenthia.LiquidAR.Web';
  }, []);
  useEffect(() => {
    if (list.data && !list.isFetching) {
      const last = Math.max(
        0,
        Math.ceil(list.data.total / pagination.pageSize) - 1,
      );
      if (pagination.page > last) setPagination((p) => ({ ...p, page: last }));
    }
  }, [list.data, list.isFetching, pagination]);
  const open = (next: Editor) => {
    setNuevaCentral(false);
    save.reset();
    setFeedback('');
    setAcceptedRevision(null);
    setFormKey((k) => k + 1);
    setEditor(next);
  };
  const close = () => {
    if (!busy && !locked.current) setEditor(null);
  };
  const submit = async (data: ReglaWrite, destination: SaveDestination) => {
    if (!canWrite || !editor || readonly || locked.current) return;
    locked.current = true;
    try {
      const result = await save.mutateAsync({
        id: editor.id,
        data: {
          ...data,
          centralizada: editor.id
            ? Boolean(detail.data?.regla.centralizada)
            : nuevaCentral,
        },
      });
      setFeedback(
        `Regla publicada correctamente. Revisión ${result.revision}.`,
      );
      setAcceptedRevision(null);
      setFormKey((k) => k + 1);
      setEditor(
        destination === 'close'
          ? null
          : destination === 'new'
            ? { id: null, kind: 'create' }
            : { id: result.idRegla, kind: 'edit' },
      );
    } catch {
      /* Keep the draft and show the normalized mutation error. */
    } finally {
      locked.current = false;
    }
  };
  const showHistory = (r: Regla) => {
    setHistoryPage({ page: 0, pageSize: 25 });
    setHistory(r);
  };
  if (permissions.isPending)
    return (
      <section className="reglas-page">
        <h1>Reglas de ajuste</h1>
        <DataGridSkeleton columns={6} actions selection />
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
        <h1>Reglas de ajuste</h1>
        <Notice>No tenés permiso para consultar reglas de ajuste.</Notice>
      </>
    );
  return (
    <section className="reglas-page">
      <h1 tabIndex={-1}>Reglas de ajuste</h1>
      <div className="regla-filters">
        <SelectionSearch
          label="Buscar reglas"
          value={filters.buscar}
          onChange={(buscar) => {
            setFilters((f) => ({ ...f, buscar: buscar.slice(0, 200) }));
            setPagination((p) => ({ ...p, page: 0 }));
          }}
        />
        <label>
          Período de consulta
          <input
            type="month"
            value={filters.periodo}
            onChange={(e) => {
              setFilters((f) => ({
                ...f,
                periodo: e.target.value,
                estado: e.target.value ? f.estado : '',
              }));
              setPagination((p) => ({ ...p, page: 0 }));
            }}
          />
        </label>
        <label>
          Estado
          <Select
            value={filters.estado}
            disabled={!filters.periodo}
            onChange={(e) => {
              setFilters((f) => ({ ...f, estado: e.target.value }));
              setPagination((p) => ({ ...p, page: 0 }));
            }}
          >
            <option value="">Todos</option>
            {Object.entries(estados).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <p className="regla-hint">
        El estado corresponde al período consultado; no indica que las
        condiciones se cumplan para todos los legajos. Publicar no modifica
        recibos existentes.
      </p>
      <DataGrid
        label="Reglas de ajuste"
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
        showSearch={false}
        showFilterButton={false}
        loading={list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => void list.refetch()}
        emptyMessage="No hay reglas para los filtros indicados."
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
            onClick: () => open({ id: null, kind: 'create' }),
          },
        ]}
        rowActions={[
          {
            id: 'view',
            label: 'Ver',
            onClick: (r) =>
              open({ id: r.id, kind: 'view', versionId: r.versionPeriodo?.id }),
          },
          {
            id: 'edit',
            label: 'Editar',
            visible: puedeEditar,
            onClick: (r) =>
              open({ id: r.id, kind: 'edit', versionId: r.versionPeriodo?.id }),
          },
          { id: 'history', label: 'Historial', onClick: showHistory },
          {
            id: 'deactivate',
            label: 'Desactivar',
            visible: puedeEditar,
            onClick: (r) =>
              open({
                id: r.id,
                kind: 'deactivate',
                versionId: r.versionPeriodo?.id,
              }),
          },
        ]}
      />
      {feedback && !editor && <p role="status">{feedback}</p>}
      <Modal
        open={!!editor}
        size="large"
        title={
          readonly
            ? 'Ver regla de ajuste'
            : editor?.kind === 'deactivate'
              ? 'Desactivar regla de ajuste'
              : editor?.id
                ? 'Editar regla de ajuste'
                : 'Nueva regla de ajuste'
        }
        titleIcon={<Icon name={readonly ? 'eye' : 'edit'} />}
        subtitle="Vigencia, fórmulas individuales y condiciones de aplicación."
        onClose={close}
        closeDisabled={busy}
        acceptButton={
          readonly
            ? false
            : {
                label: 'Guardar y cerrar',
                type: 'submit',
                form: 'regla-form',
                loading: busy,
                disabled: loading || !!loadError || !canWrite,
              }
        }
        cancelButton={{
          label: readonly ? 'Cerrar' : 'Cancelar',
          disabled: busy,
        }}
        actions={
          readonly ? undefined : (
            <FormDialogActions
              form="regla-form"
              busy={busy}
              loading={loading}
              hasError={!!loadError || !canWrite}
              onUndo={() => {
                save.reset();
                setFeedback('');
                setAcceptedRevision(null);
                setFormKey((k) => k + 1);
                if (editor?.id) {
                  void detail.refetch();
                  if (editor.versionId) void selected.refetch();
                }
              }}
            />
          )
        }
      >
        {feedback && <p role="status">{feedback}</p>}
        {!editor?.id && permissions.data?.isSuperAdmin && (
          <label>
            <input
              type="checkbox"
              checked={nuevaCentral}
              disabled={busy}
              onChange={(event) => setNuevaCentral(event.target.checked)}
            />
            Regla central compartida
          </label>
        )}
        {loading && !loadError && <ReglaFormSkeleton />}
        {loadError && (
          <>
            <Notice>{errorMessage(loadError)}</Notice>
            <Button
              onClick={() => {
                void detail.refetch();
                if (editor?.kind === 'deactivate') void programadas.refetch();
                if (editor?.versionId) void selected.refetch();
              }}
            >
              Reintentar datos
            </Button>
          </>
        )}
        {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
        {save.error instanceof ApiError && save.error.status === 409 && (
          <div className="regla-conflict">
            <p>
              El borrador se conserva. Consultá la publicación actual antes de
              volver a publicar.
            </p>
            <Button
              disabled={revisar.isPending}
              onClick={async () => {
                try {
                  const r = await revisar.mutateAsync(editor!.id!);
                  if (r.ultimaVersion) setReview(r.ultimaVersion);
                } catch {
                  /* Show error without replacing draft. */
                }
              }}
            >
              Consultar publicación actual
            </Button>
          </div>
        )}
        {revisar.isError && <Notice>{errorMessage(revisar.error)}</Notice>}
        {editor?.id && detail.data && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => showHistory(detail.data!.regla)}
          >
            Consultar historial y cambios programados
          </Button>
        )}
        {editor && !loading && !loadError && (
          <ReglaForm
            key={formKey}
            centralizada={
              editor.id
                ? Boolean(detail.data?.regla.centralizada)
                : nuevaCentral
            }
            reglaId={editor.id}
            nombre={editor.id ? name : ''}
            version={editor.id ? initial : null}
            revision={
              acceptedRevision ?? detail.data?.regla.revisionActual ?? 0
            }
            editing={!!editor.id}
            readOnly={readonly || !canWrite}
            deactivate={editor.kind === 'deactivate'}
            busy={busy}
            programadas={programadas.data}
            onSubmit={submit}
          />
        )}
      </Modal>
      <Modal
        open={!!history}
        title={`Historial · ${history?.nombre ?? ''}`}
        size="large"
        onClose={() => setHistory(null)}
        acceptButton={false}
        cancelButton={{ label: 'Cerrar' }}
      >
        <p>
          Las versiones se conservan. Para cada período se toma el inicio más
          reciente y luego su mayor revisión. Una versión inactiva o vencida no
          reactiva versiones anteriores.
        </p>
        <DataGrid
          label="Historial de regla"
          rows={versions.data?.items ?? []}
          columns={historyColumns}
          getRowId={(v) => v.id}
          processingMode="server"
          rowCount={versions.data?.total ?? 0}
          paginationModel={historyPage}
          onPaginationModelChange={setHistoryPage}
          pageSizeOptions={[25]}
          showSearch={false}
          showFilterButton={false}
          loading={versions.isFetching}
          error={versions.isError ? errorMessage(versions.error) : null}
          onRetry={() => void versions.refetch()}
          rowActions={[
            { id: 'view', label: 'Ver versión', onClick: (v) => setReview(v) },
            {
              id: 'edit',
              label: 'Preparar cambio',
              visible: () =>
                Boolean(
                  canWrite &&
                  !editor &&
                  (!history?.centralizada || permissions.data?.isSuperAdmin),
                ),
              onClick: (v) => {
                setHistory(null);
                open({ id: v.idRegla, kind: 'edit', versionId: v.id });
              },
            },
          ]}
        />
      </Modal>
      <Modal
        open={!!review}
        size="large"
        title={`Revisión ${review?.revision ?? ''}`}
        onClose={() => setReview(null)}
        acceptButton={false}
        cancelButton={{ label: 'Cerrar' }}
      >
        {review && (
          <ReglaForm
            key={review.id}
            nombre={history?.nombre ?? name}
            version={review}
            revision={review.revision}
            editing
            readOnly
            deactivate={false}
            busy={false}
            onSubmit={async () => {}}
          />
        )}
        {review &&
          save.error instanceof ApiError &&
          save.error.status === 409 &&
          !history && (
            <Button
              onClick={() => {
                setAcceptedRevision(review.revision);
                setReview(null);
                save.reset();
                setFeedback(
                  'Revisión actualizada. Revisá el borrador y guardá para publicar.',
                );
              }}
            >
              Conservar borrador y usar revisión {review.revision}
            </Button>
          )}
      </Modal>
    </section>
  );
}
