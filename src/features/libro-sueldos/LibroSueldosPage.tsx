import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DataGrid,
  type DataGridColumn,
  type DataGridValue,
} from '@/components/ui/DataGrid';
import { Modal } from '@/components/ui/Modal';
import {
  FormDialogActions,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Notice } from '@/components/ui/Notice';
import { DataGridSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { ApiError, errorMessage } from '@/services/http/ApiError';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { useLibro, useLibros, useLsdReferencias, useLsdSave } from './hooks';
import { libroService } from './service';
import { fields01, fields02, fields03, fields04 } from './fields';
import { RecordForm, RecordSkeleton } from './RecordForm';
import { ConfiguracionLsd } from './ConfiguracionLsd';
import { ConflictReview } from './ConflictReview';
import { HistorialLsd } from './HistorialLsd';
import { EstadoPersistidoLsd } from './EstadoPersistidoLsd';
import {
  nuevoLibro,
  type Fila,
  type Libro,
  type Registro01,
  type Registro02,
  type Registro03,
  type Registro04,
} from './types';
import './libro-sueldos.css';

type Editor = { kind: 'create' } | { kind: 'edit' | 'view'; id: number };
type Operation = {
  kind: 'generar' | 'exportar' | 'pago' | 'borrar';
  row: Fila;
};
type Tab = '02' | '03' | '04';
type Detalle = Registro02 | Registro03 | Registro04;
const listColumns = (
  [
    { field: 'empresa', header: 'Empresa', getValue: (r) => r.empresa },
    { field: 'periodo', header: 'Período', getValue: (r) => r.periodo },
    {
      field: 'tipo',
      header: 'Tipo de liquidación',
      getValue: (r) => r.tipoLiquidacion,
    },
    {
      field: 'numero',
      header: 'N.º liquidación',
      getValue: (r) => r.numeroDeLiquidacion,
    },
    {
      field: 'generado',
      header: 'Generado',
      getValue: (r) => r.generado,
      type: 'boolean',
    },
    {
      field: 'exportado',
      header: 'Exportado',
      getValue: (r) => r.exportado,
      type: 'boolean',
    },
    {
      field: 'fechaPago',
      header: 'Fecha de pago',
      getValue: (r) => r.fechaPago,
      initiallyHidden: true,
    },
  ] satisfies DataGridColumn<Fila>[]
).map((c) => ({ ...c, sortable: false, searchable: false, filterable: false }));

export function LibroSueldosPage() {
  const permissions = usePermissions();
  const canRead = permissions.can('ls.read');
  const canWrite = canRead && permissions.can('ls.write');
  const canDelete = canRead && permissions.can('ls.delete');
  const client = useQueryClient();
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [filter, setFilter] = useState({ empresa: '', periodo: '' });
  const [applied, setApplied] = useState({ empresa: '', periodo: '' });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState<Libro | null>(null);
  const [submitted, setSubmitted] = useState<Libro | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [tab, setTab] = useState<Tab>('02');
  const [detailEditor, setDetailEditor] = useState<{
    tab: Tab;
    row: Detalle;
  } | null>(null);
  const [op, setOp] = useState<Operation | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const refs = useLsdReferencias(
    draft?.cabecera.idEmpresa ?? undefined,
    canRead,
  );
  const list = useLibros(
    pagination.page + 1,
    pagination.pageSize,
    applied.empresa ? Number(applied.empresa) : undefined,
    applied.periodo || undefined,
    canRead,
  );
  const detail = useLibro(
    editor && editor.kind !== 'create' ? editor.id : null,
    editor !== null && canRead,
  );
  const save = useLsdSave();
  const uncertain = (error: unknown) =>
    error instanceof ApiError &&
    ['network', 'cancelled', 'server'].includes(error.kind);
  const diagnostico = useQuery({
    queryKey: ['libro-sueldos', 'diagnostico', op?.row.id],
    queryFn: ({ signal }) => libroService.diagnostico(op!.row.id, signal),
    enabled: op?.kind === 'generar' || op?.kind === 'exportar',
    refetchOnWindowFocus: false,
  });
  const coverage = useQuery({
    queryKey: ['libro-sueldos', 'cobertura', op?.row.id],
    queryFn: ({ signal }) => libroService.cobertura(op!.row.id, signal),
    enabled: op?.kind === 'generar',
    refetchOnWindowFocus: false,
  });
  const payRefs = useLsdReferencias(
    op?.kind === 'pago' ? (op.row.idEmpresa ?? undefined) : undefined,
    op?.kind === 'pago',
  );
  const operation = useMutation({
    mutationFn: async ({
      action,
      pago,
    }: {
      action: Operation;
      pago?: { idBanco: number | null; fechaPago: string };
    }) => {
      const { id, version } = action.row;
      if (action.kind === 'borrar') await libroService.remove(id, version);
      else if (action.kind === 'generar')
        await libroService.generar(id, version, true);
      else if (action.kind === 'pago' && pago)
        await libroService.pago(id, version, pago.idBanco ?? 0, pago.fechaPago);
      else if (action.kind === 'exportar') {
        const file = await libroService.exportar(id, version);
        const url = URL.createObjectURL(file.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.nombre;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    },
    onSuccess: async () => {
      setFeedback('La operación se completó correctamente.');
      setOp(null);
      await client.invalidateQueries({ queryKey: ['libro-sueldos'] });
    },
  });
  const busy = save.isPending || operation.isPending;
  const readOnly = editor?.kind === 'view';
  const formLoading =
    editor !== null &&
    (refs.isPending ||
      (editor.kind !== 'create' && (detail.isFetching || !draft)));
  const formError =
    refs.error ?? (editor?.kind !== 'create' ? detail.error : null);
  useEffect(() => {
    document.title = 'Libro de sueldo | Zenthia.LiquidAR.Web';
    if (!permissions.isPending)
      document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [permissions.isPending]);
  useEffect(() => {
    if (editor && editor.kind !== 'create' && detail.data && !detail.isFetching)
      setDraft(structuredClone(detail.data));
  }, [editor, detail.data, detail.isFetching]);
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
    save.reset();
    setSubmitted(null);
    setReviewed(false);
    setFeedback('');
    setFormVersion((v) => v + 1);
    setTab('02');
    setDraft(next.kind === 'create' ? nuevoLibro() : null);
    setEditor(next);
  };
  const close = () => {
    if (!busy) {
      setEditor(null);
      setDraft(null);
    }
  };
  const submit = async (cabecera: Registro01, destination: SaveDestination) => {
    if (!draft || !canWrite || busy || (uncertain(save.error) && !reviewed))
      return;
    try {
      setReviewed(false);
      setSubmitted(structuredClone({ ...draft, cabecera }));
      const result = await save.mutateAsync({ ...draft, cabecera });
      setFeedback('El libro se guardó correctamente.');
      setFormVersion((v) => v + 1);
      if (destination === 'close') close();
      else if (destination === 'new') {
        setDraft(nuevoLibro());
        setEditor({ kind: 'create' });
      } else {
        setDraft(result);
        setEditor({ kind: 'edit', id: result.cabecera.id });
      }
    } catch {
      /* Keep form and local detail changes. */
    }
  };
  const beginOperation = (kind: Operation['kind'], row: Fila) => {
    operation.reset();
    setFeedback('');
    setOp({ kind, row });
  };
  if (permissions.isPending)
    return (
      <section className="lsd-page">
        <h1>Libro de sueldo</h1>
        <DataGridSkeleton
          columns={6}
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
        <h1>Libro de sueldo</h1>
        <Notice>No tenés permiso para consultar Libro de sueldo.</Notice>
      </>
    );
  const detailFields =
    tab === '02' ? fields02 : tab === '03' ? fields03 : fields04;
  const detailRows: Detalle[] = draft
    ? tab === '02'
      ? draft.registros02
      : tab === '03'
        ? draft.registros03
        : draft.registros04
    : [];
  const detailColumns: DataGridColumn<Detalle>[] = detailFields.map(
    (f, index) => ({
      field: f.name,
      header: f.label,
      getValue: (r) => (r as unknown as Record<string, DataGridValue>)[f.name],
      initiallyHidden: index >= 5,
      format: f.lookup
        ? (value) =>
            refs.data?.opciones[f.lookup!]?.find((o) => o.id === value)
              ?.nombre ?? String(value ?? '')
        : undefined,
    }),
  );
  return (
    <section className="lsd-page">
      <div className="lsd-heading">
        <h1 tabIndex={-1}>Libro de sueldo</h1>
      </div>
      {refs.isError && (
        <>
          <Notice>{errorMessage(refs.error)}</Notice>
          <Button onClick={() => void refs.refetch()}>
            Reintentar referencias
          </Button>
        </>
      )}
      <form
        className="lsd-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filter);
          setPagination((p) => ({ ...p, page: 0 }));
        }}
      >
        <div className="field">
          <label htmlFor="lsd-filter-empresa">Empresa</label>
          <Select
            id="lsd-filter-empresa"
            disabled={refs.isPending}
            value={filter.empresa}
            onChange={(e) =>
              setFilter((f) => ({ ...f, empresa: e.target.value }))
            }
          >
            <option value="">Todas las empresas</option>
            {refs.data?.opciones.empresas?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Período (MMAAAA)"
          value={filter.periodo}
          maxLength={6}
          onChange={(e) =>
            setFilter((f) => ({ ...f, periodo: e.target.value }))
          }
        />
        <Button type="submit" disabled={list.isFetching}>
          Aplicar filtros
        </Button>
        <Button
          variant="ghost"
          disabled={refs.isPending || refs.isError}
          onClick={() => setConfigOpen(true)}
        >
          Configuración de conceptos
        </Button>
      </form>
      <DataGrid
        label="Libros de sueldo"
        rows={list.isError ? [] : (list.data?.items ?? [])}
        columns={listColumns}
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
        searchUnavailableReason="Utilizá los filtros de empresa y período."
        filtersUnavailableReason="Utilizá los filtros de empresa y período."
        loading={list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => void list.refetch()}
        emptyMessage="No hay libros de sueldo para mostrar."
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
            onClick: (r) => open({ kind: 'view', id: r.id }),
          },
          {
            id: 'edit',
            label: 'Editar',
            visible: () => canWrite,
            onClick: (r) => open({ kind: 'edit', id: r.id }),
          },
          {
            id: 'generar',
            label: 'Generar',
            visible: () => canWrite,
            onClick: (r) => beginOperation('generar', r),
          },
          {
            id: 'exportar',
            label: 'Exportar TXT',
            visible: () => canWrite,
            disabled: (r) => !r.generado,
            onClick: (r) => beginOperation('exportar', r),
          },
          {
            id: 'pago',
            label: 'Registrar pago',
            visible: () => canWrite,
            disabled: (r) => !r.exportado,
            onClick: (r) => beginOperation('pago', r),
          },
          {
            id: 'delete',
            label: 'Eliminar',
            visible: () => canDelete,
            onClick: (r) => beginOperation('borrar', r),
          },
        ]}
      />
      {feedback && !editor && <p role="status">{feedback}</p>}
      <Modal
        open={editor !== null}
        title={
          readOnly
            ? 'Ver libro de sueldo'
            : editor?.kind === 'create'
              ? 'Nuevo libro de sueldo'
              : 'Editar libro de sueldo'
        }
        onClose={close}
        closeDisabled={busy}
        size="large"
        cancelButton={{
          label: readOnly ? 'Cerrar' : 'Cancelar',
          disabled: busy,
        }}
        acceptButton={
          readOnly
            ? false
            : {
                label: 'Guardar y cerrar',
                type: 'submit',
                form: 'lsd-header-form',
                loading: save.isPending,
                disabled:
                  formLoading ||
                  Boolean(formError) ||
                  (uncertain(save.error) && !reviewed),
              }
        }
        actions={
          !readOnly && (
            <FormDialogActions
              form="lsd-header-form"
              busy={busy}
              loading={formLoading}
              hasError={
                Boolean(formError) || (uncertain(save.error) && !reviewed)
              }
              onUndo={() => {
                save.reset();
                setFeedback('');
                setFormVersion((v) => v + 1);
                if (editor?.kind === 'create') setDraft(nuevoLibro());
                else {
                  setDraft(null);
                  void detail.refetch();
                }
              }}
            />
          )
        }
      >
        {feedback && <p role="status">{feedback}</p>}
        {formError && (
          <>
            <Notice>{errorMessage(formError)}</Notice>
            <Button
              onClick={() => {
                void refs.refetch();
                if (editor?.kind !== 'create') void detail.refetch();
              }}
            >
              Reintentar datos
            </Button>
          </>
        )}
        {formLoading && !formError && (
          <>
            <Skeleton width="45%" height={16} />
            <RecordSkeleton
              fields={fields01.filter(
                (f) => f.name !== 'cantidadDeRegistros04',
              )}
            />
            {editor?.kind !== 'create' && (
              <>
                <div className="lsd-tabs" aria-hidden="true">
                  <Skeleton width={90} height={28} />
                  <Skeleton width={90} height={28} />
                  <Skeleton width={90} height={28} />
                </div>
                <DataGridSkeleton
                  columns={5}
                  actions
                  label="Cargando registros del libro…"
                />
              </>
            )}
          </>
        )}
        {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
        {uncertain(save.error) && submitted && (
          <EstadoPersistidoLsd
            id={submitted.cabecera.id}
            empresa={submitted.cabecera.idEmpresa}
            periodo={submitted.cabecera.periodo}
            onReviewed={() => setReviewed(true)}
          />
        )}
        {save.error instanceof ApiError &&
          save.error.kind === 'conflict' &&
          submitted &&
          submitted.cabecera.id > 0 && (
            <ConflictReview
              local={submitted}
              onReload={(value) => {
                save.reset();
                setSubmitted(null);
                setDraft(structuredClone(value));
                setFormVersion((v) => v + 1);
              }}
            />
          )}
        {!formLoading && !formError && draft && (
          <>
            <p className="lsd-state">
              Generado: {draft.cabecera.generado ? 'Sí' : 'No'} · Exportado:{' '}
              {draft.cabecera.exportado ? 'Sí' : 'No'}
              {draft.cabecera.fechaPago
                ? ' · Pago: ' + draft.cabecera.fechaPago.slice(0, 10)
                : ''}
            </p>
            <RecordForm
              key={formVersion}
              id="lsd-header-form"
              fields={fields01.filter(
                (f) => f.name !== 'cantidadDeRegistros04',
              )}
              initial={draft.cabecera}
              opciones={refs.data?.opciones}
              busy={busy}
              readOnly={readOnly}
              error={save.error}
              onSubmit={submit}
            />
            {editor?.kind !== 'create' && (
              <>
                <HistorialLsd
                  id={draft.cabecera.id}
                  version={draft.cabecera.version}
                />
                <p className="field-note">
                  Cantidad registros 04:{' '}
                  <output>{draft.cabecera.cantidadDeRegistros04}</output>
                </p>
                <div
                  className="lsd-tabs"
                  role="group"
                  aria-label="Registros del libro"
                >
                  {(['02', '03', '04'] as Tab[]).map((t) => (
                    <Button
                      key={t}
                      variant={tab === t ? 'primary' : 'ghost'}
                      aria-pressed={tab === t}
                      onClick={() => setTab(t)}
                    >
                      Registro {t}
                    </Button>
                  ))}
                </div>
                <DataGrid
                  label={'Registros ' + tab}
                  rows={detailRows}
                  columns={detailColumns}
                  getRowId={(r) => r.id}
                  pageSizeOptions={[10, 25, 50, 100]}
                  rowHeight={48}
                  emptyMessage="No hay registros para mostrar."
                  rowActions={[
                    {
                      id: 'edit',
                      label: readOnly ? 'Ver' : 'Editar',
                      onClick: (row) =>
                        setDetailEditor({ tab, row: structuredClone(row) }),
                    },
                  ]}
                />
                {!readOnly && (
                  <p className="field-note">
                    Las modificaciones de detalles se guardan junto con el
                    libro.
                    {tab === '03' &&
                      ' Desactivar Informar cantidad en TXT conserva la cantidad original y exporta cero con unidad en blanco. Requiere una clasificación ARCA compatible en Configuración. No modifica el recibo.'}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={detailEditor !== null}
        title={
          (readOnly ? 'Ver registro ' : 'Editar registro ') +
          (detailEditor?.tab ?? '')
        }
        size="large"
        onClose={() => setDetailEditor(null)}
        cancelButton={{ label: readOnly ? 'Cerrar' : 'Cancelar' }}
        acceptButton={
          readOnly
            ? false
            : {
                label: 'Aplicar al borrador',
                type: 'submit',
                form: 'lsd-detail-form',
              }
        }
      >
        {detailEditor && (
          <RecordForm
            id="lsd-detail-form"
            fields={
              detailEditor.tab === '02'
                ? fields02
                : detailEditor.tab === '03'
                  ? fields03
                  : fields04
            }
            initial={detailEditor.row}
            opciones={refs.data?.opciones}
            busy={false}
            readOnly={readOnly}
            onSubmit={async (value) => {
              setDraft((d) =>
                !d
                  ? d
                  : {
                      ...d,
                      registros02:
                        detailEditor.tab === '02'
                          ? d.registros02.map((r) =>
                              r.id === value.id ? (value as Registro02) : r,
                            )
                          : d.registros02,
                      registros03:
                        detailEditor.tab === '03'
                          ? d.registros03.map((r) =>
                              r.id === value.id ? (value as Registro03) : r,
                            )
                          : d.registros03,
                      registros04:
                        detailEditor.tab === '04'
                          ? d.registros04.map((r) =>
                              r.id === value.id ? (value as Registro04) : r,
                            )
                          : d.registros04,
                    },
              );
              setDetailEditor(null);
            }}
          />
        )}
      </Modal>
      <Modal
        open={op !== null}
        title={
          op?.kind === 'generar'
            ? 'Generar registros'
            : op?.kind === 'exportar'
              ? 'Exportar TXT'
              : op?.kind === 'pago'
                ? 'Registrar pago'
                : 'Confirmar eliminación'
        }
        onClose={() => {
          if (!busy) setOp(null);
        }}
        closeDisabled={busy}
        cancelButton={{ disabled: busy }}
        acceptButton={{
          label: op?.kind === 'pago' ? 'Registrar pago' : 'Confirmar',
          loading: operation.isPending,
          disabled:
            uncertain(operation.error) ||
            (op?.kind === 'generar' &&
              (coverage.isPending ||
                coverage.isError ||
                Boolean(coverage.data?.some((r) => r.error)))),
          ...(op?.kind === 'pago'
            ? {
                type: 'submit' as const,
                form: 'lsd-pago-form',
                disabled:
                  payRefs.isPending ||
                  payRefs.isError ||
                  uncertain(operation.error),
              }
            : {}),
        }}
        onAccept={async () => {
          if (op && !busy && op.kind !== 'pago') {
            try {
              await operation.mutateAsync({ action: op });
            } catch {
              /* Keep confirmation and error. */
            }
          }
        }}
      >
        {(op?.kind === 'generar' || op?.kind === 'exportar') && (
          <section aria-label="Diagnóstico previo">
            <p>
              El TXT admite envíos SJ. Exportado indica que el servidor preparó
              el archivo; no confirma su descarga ni la aceptación de ARCA.
            </p>
            {diagnostico.isPending && (
              <p role="status">Revisando fuentes y registros guardados…</p>
            )}
            {diagnostico.isError && (
              <Notice>{errorMessage(diagnostico.error)}</Notice>
            )}
            {diagnostico.data && (
              <>
                <p>
                  Revisión orientativa de la versión {diagnostico.data.version}.
                  Se muestra el primer bloqueo por trabajador y de exportación;
                  los datos pueden cambiar después de esta consulta.
                </p>
                {diagnostico.data.problemas.length === 0 ? (
                  <p>No se detectaron bloqueos en esta revisión.</p>
                ) : (
                  <ul>
                    {diagnostico.data.problemas.map((p, i) => (
                      <li key={i}>
                        {p.etapa} ·{' '}
                        {p.idLegajo ? `Legajo ID ${p.idLegajo} · ` : ''}
                        {p.idRecibo ? `Recibo ID ${p.idRecibo} · ` : ''}
                        {p.campo}: {p.mensaje} {p.accion}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <Button
              disabled={diagnostico.isFetching}
              onClick={() => void diagnostico.refetch()}
            >
              Actualizar diagnóstico
            </Button>
          </section>
        )}
        {op?.kind === 'generar' && (
          <>
            <p>
              Se generarán los registros desde los recibos de la empresa,
              período y tipo del libro. Si ya existen detalles, se reemplazarán
              y se perderán sus cambios manuales. Los datos de exportación y
              pago se conservan.
            </p>
            {coverage.isPending && (
              <p role="status">Revisando códigos de conceptos…</p>
            )}
            {coverage.isError && (
              <>
                <Notice>{errorMessage(coverage.error)}</Notice>
                <Button onClick={() => void coverage.refetch()}>
                  Reintentar revisión
                </Button>
              </>
            )}
            {coverage.data && (
              <DataGrid
                label="Códigos que se utilizarán"
                rows={coverage.data}
                getRowId={(r) => r.idFormula}
                columns={[
                  {
                    field: 'formula',
                    header: 'Fórmula',
                    getValue: (r) => r.descripcion,
                  },
                  {
                    field: 'codigo',
                    header: 'Código TXT',
                    getValue: (r) => r.codigo,
                  },
                  {
                    field: 'origen',
                    header: 'Origen',
                    getValue: (r) =>
                      r.origen === 'Formula'
                        ? 'Código de fórmula'
                        : r.origen === 'Empresa'
                          ? 'Configurado por empresa'
                          : 'Conflicto',
                  },
                  {
                    field: 'error',
                    header: 'Observación',
                    getValue: (r) => r.error,
                  },
                ]}
                emptyMessage="No hay conceptos de recibos para esta selección."
              />
            )}
          </>
        )}
        {op?.kind === 'exportar' && (
          <p>
            Se descargará el TXT de los registros guardados. La exportación se
            registrará cuando el servidor prepare correctamente el archivo.
          </p>
        )}
        {op?.kind === 'borrar' && (
          <p>
            ¿Deseás eliminar este libro? Los libros con detalles dependientes
            conservan las restricciones de eliminación.
          </p>
        )}
        {op?.kind === 'pago' && (
          <>
            {payRefs.isError ? (
              <>
                <Notice>{errorMessage(payRefs.error)}</Notice>
                <Button onClick={() => void payRefs.refetch()}>
                  Reintentar bancos
                </Button>
              </>
            ) : payRefs.isPending ? (
              <RecordSkeleton fields={pagoFields} />
            ) : (
              <RecordForm
                id="lsd-pago-form"
                fields={pagoFields}
                initial={{ idBanco: null as number | null, fechaPago: '' }}
                opciones={payRefs.data?.opciones}
                busy={busy}
                error={operation.error}
                onSubmit={async (value) => {
                  if (uncertain(operation.error)) return;
                  try {
                    await operation.mutateAsync({ action: op, pago: value });
                  } catch {
                    /* Keep draft. */
                  }
                }}
              />
            )}
          </>
        )}
        {operation.isError && (
          <Notice>
            {operation.error instanceof ApiError &&
            Object.keys(operation.error.fieldErrors).length > 0 ? (
              <>
                <p>
                  Revisá los datos indicados antes de volver a exportar o
                  guardar.
                </p>
                <ul>
                  {Object.values(operation.error.fieldErrors)
                    .flatMap((message) => message.split('\n'))
                    .map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                </ul>
              </>
            ) : (
              errorMessage(operation.error)
            )}
          </Notice>
        )}
        {op && uncertain(operation.error) && (
          <EstadoPersistidoLsd
            id={op.row.id}
            empresa={op.row.idEmpresa}
            periodo={op.row.periodo}
          />
        )}
      </Modal>
      <ConfiguracionLsd
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        empresaInicial={applied.empresa ? Number(applied.empresa) : undefined}
        canWrite={canWrite}
        referencias={refs.data}
      />
    </section>
  );
}
const pagoFields = [
  {
    name: 'idBanco',
    label: 'Banco de la empresa',
    kind: 'select' as const,
    lookup: 'bancos',
    required: true,
  },
  {
    name: 'fechaPago',
    label: 'Fecha de pago (AAAA-MM-DD)',
    kind: 'date' as const,
    required: true,
  },
];
