import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Notice } from '@/components/ui/Notice';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import {
  DataGrid,
  type DataGridColumn,
  type DataGridSelectionModel,
} from '@/components/ui/DataGrid';
import { errorMessage } from '@/services/http/ApiError';
import { descargar } from '@/services/http/downloadFile';
import { ReciboPreviewDialog } from '@/features/recibos/ReciboPreviewDialog';
import type { ReciboPreviewTarget } from '@/features/recibos/hooks';
import { useRecibosZip } from '@/features/recibos/hooks';
import { ZipFeedback } from '@/features/recibos/ZipFeedback';
import { ApiError } from '@/services/http/ApiError';
import { recibosService } from '@/features/recibos/service';
import { NovedadEditor } from '@/features/novedades/Editor';
import {
  draftOf,
  type Draft,
  type Liquidacion,
} from '@/features/novedades/types';
import { toCambio } from '@/features/novedades/schema';
import { useLiquidaciones, useLiquidacionesCapacidades } from './hooks';
import { liquidacionesService as api, type LiquidacionFila } from './service';
import '@/features/novedades/novedades.css';

export function LiquidacionesPage() {
  const capabilities = useLiquidacionesCapacidades();
  const canRead = capabilities.data?.generar === true;
  const canConsultarRecibos = capabilities.data?.leer === true;
  const canGenerate = canRead && capabilities.data?.generar === true;
  const now = new Date();
  const [mes, setMes] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [tipo, setTipo] = useState('');
  const [empresa, setEmpresa] = useState(0);
  const [fecha, setFecha] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('');
  const zip = useRecibosZip();
  const descarga = useRef<AbortController | null>(null);
  useEffect(() => () => descarga.current?.abort(), []);
  const [convenio, setConvenio] = useState('');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [selection, setSelection] = useState<DataGridSelectionModel>({
    type: 'include',
    ids: [],
  });
  const [result, setResult] = useState<Liquidacion | null>(null);
  const [preview, setPreview] = useState<ReciboPreviewTarget | null>(null);
  const [confirm, setConfirm] = useState<'generar' | number | null>(null);
  const [editor, setEditor] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');
  const c = {
    idEmpresa: empresa,
    periodo: mes.slice(5, 7) + mes.slice(0, 4),
    idTipoLiquidacion: Number(tipo),
  };
  const { tipos, empresas, filas, invalidate, action, convenios } =
    useLiquidaciones(c, pagination, buscar, canRead, estado, convenio);
  const rows = filas.data?.items ?? [];
  const selected = rows.filter(
    (r) =>
      r.seleccionable &&
      selection.type === 'include' &&
      selection.ids.includes(r.idLegajo),
  );
  const generados =
    result?.items.flatMap((r) =>
      r.estado === 'generado' &&
      r.recibo?.calculado &&
      r.recibo.persistido &&
      r.recibo.reciboId
        ? [r.recibo.reciboId]
        : [],
    ) ?? [];
  const busy = action.isPending || zip.isPending;
  const descargarZip = (ids: number[]) => {
    if (busy || !canConsultarRecibos || !ids.length || ids.length > 100) return;
    setMessage('');
    const controller = new AbortController();
    descarga.current = controller;
    zip.mutate(
      { ids, signal: controller.signal },
      {
        onSuccess: (file) => {
          descargar(file.blob, file.nombre);
          setMessage('Descarga del ZIP iniciada.');
        },
        onError: (error) => {
          if (error instanceof ApiError && error.kind === 'cancelled')
            setMessage('Descarga cancelada.');
        },
        onSettled: () => {
          if (descarga.current === controller) descarga.current = null;
        },
      },
    );
  };
  const run = (fn: () => Promise<void>) => {
    setMessage('');
    zip.reset();
    action.mutate(fn, { onError: (e) => setMessage(errorMessage(e)) });
  };
  const reset = () => {
    setSelection({ type: 'include', ids: [] });
    setPagination((p) => ({ ...p, page: 0 }));
    setResult(null);
    setMessage('');
    zip.reset();
  };
  const liquidar = async (persistir: boolean) => {
    if (!selected.length || !fecha || filas.isFetching) return;
    const res = await api.liquidar(
      c,
      fecha,
      selected.map((r) => r.idLegajo),
      persistir,
    );
    setResult(res);
    setSelection({ type: 'include', ids: [] });
    await invalidate();
  };
  const pdf = (id: number) =>
    run(async () => {
      const file = await recibosService.pdf(id);
      descargar(file.blob, file.nombre);
    });
  const columns: DataGridColumn<LiquidacionFila>[] = [
    { field: 'numero', header: 'Legajo', getValue: (r) => r.numero, width: 90 },
    {
      field: 'nombre',
      header: 'Empleado',
      getValue: (r) => r.nombre,
      minWidth: 180,
      render: (r) => (
        <>
          {!r.idRecibo &&
            (!r.seleccionable ||
              r.usaDiasCategoria ||
              r.usaVacacionesPredeterminadas) && <Icon name="warning" />}{' '}
          {r.nombre}
          {!r.idRecibo && !r.seleccionable && (
            <div>
              <small>Novedades pendientes o datos a revisar</small>
            </div>
          )}
        </>
      ),
    },
    {
      field: 'estado',
      header: 'Disponibilidad',
      getValue: (r) =>
        r.idRecibo ? 'Liquidado' : r.seleccionable ? 'Disponible' : 'Pendiente',
      minWidth: 260,
      render: (r) => (
        <div>
          {r.idRecibo ? (
            'Liquidado'
          ) : r.seleccionable ? (
            <>
              {(r.usaDiasCategoria || r.usaVacacionesPredeterminadas) && (
                <Icon name="warning" />
              )}{' '}
              Disponible
              {(r.usaDiasCategoria || r.usaVacacionesPredeterminadas) && (
                <div>Se usarán valores por defecto</div>
              )}
            </>
          ) : (
            <>
              <Icon name="warning" /> No disponible
            </>
          )}
          {r.errores.map((e) => (
            <div key={e}>{e}</div>
          ))}
          {r.formulasPendientes.map((f) => (
            <div key={f.id}>
              Falta: {f.descripcion || f.codigo || `Fórmula ${f.id}`}
            </div>
          ))}
        </div>
      ),
    },
    {
      field: 'dias',
      header: 'Días trabajados',
      getValue: (r) => r.diasTrabajados,
      minWidth: 160,
      render: (r) => (
        <>
          {r.diasTrabajados ?? 'Sin valor de categoría'}
          {r.usaDiasCategoria && <small> · categoría</small>}
        </>
      ),
    },
    {
      field: 'vacaciones',
      header: 'Vacaciones',
      getValue: (r) => r.diasVacaciones,
      minWidth: 140,
      render: (r) => (
        <>
          {r.diasVacaciones} días
          {r.usaVacacionesPredeterminadas && <small> · por defecto</small>}
        </>
      ),
    },
  ];
  if (capabilities.isPending) return <p role="status">Verificando permisos…</p>;
  if (capabilities.isError)
    return (
      <Notice>
        {errorMessage(capabilities.error)}{' '}
        <Button onClick={() => void capabilities.refetch()}>Reintentar</Button>
      </Notice>
    );
  if (!canRead)
    return <Notice>No tenés permiso para consultar liquidaciones.</Notice>;
  return (
    <section className="novedades-work">
      <h1>Liquidaciones</h1>
      <p>Revisá los legajos, previsualizá y generá sus recibos.</p>
      <Notice tone="info">
        Los conceptos que requieren novedades deben estar informados antes de
        liquidar. Si faltan días trabajados se usa la categoría; si faltan
        vacaciones se usan 0 días. Un cero informado se conserva.
      </Notice>
      <div className="novedades-context">
        <label>
          Período
          <input
            type="month"
            value={mes}
            disabled={busy}
            onChange={(e) => {
              setMes(e.target.value);
              setEmpresa(0);
              reset();
            }}
          />
        </label>
        <label>
          Tipo de liquidación
          <Select
            value={tipo}
            disabled={busy}
            onChange={(e) => {
              setTipo(e.target.value);
              setEmpresa(0);
              reset();
            }}
          >
            <option value="">Seleccionar</option>
            {tipos.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Empresa
          <Select
            value={empresa}
            disabled={busy || !tipo}
            onChange={(e) => {
              setEmpresa(Number(e.target.value));
              reset();
            }}
          >
            <option value={0}>Seleccionar</option>
            {empresas.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Fecha de pago
          <input
            type="date"
            value={fecha}
            disabled={busy}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
      </div>
      {(tipos.isError || empresas.isError) && (
        <Notice>{errorMessage(tipos.error ?? empresas.error)}</Notice>
      )}
      {message && (
        <Notice
          tone={
            message === 'Descarga del ZIP iniciada.'
              ? 'success'
              : message === 'Descarga cancelada.'
                ? 'info'
                : 'error'
          }
        >
          {message}
        </Notice>
      )}
      <ZipFeedback zip={zip} onCancel={() => descarga.current?.abort()} />
      {!!empresa && (
        <>
          <div className="novedades-tools">
            <label>
              Convenio
              <Select
                value={convenio}
                disabled={busy}
                onChange={(e) => {
                  setConvenio(e.target.value);
                  reset();
                }}
              >
                <option value="">Todos</option>
                {convenios.data?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Situación
              <Select
                value={estado}
                disabled={busy}
                onChange={(e) => {
                  setEstado(e.target.value);
                  reset();
                }}
              >
                <option value="">Todos</option>
                <option value="sin-recibo">Sin recibo</option>
                <option value="pendientes">Novedades pendientes</option>
                <option value="errores">Con errores</option>
                <option value="generados">Liquidados</option>
              </Select>
            </label>
            {convenios.isError && (
              <Notice>
                {errorMessage(convenios.error)}{' '}
                <Button onClick={() => void convenios.refetch()}>
                  Reintentar convenios
                </Button>
              </Notice>
            )}
          </div>
          <div className="novedades-tools">
            <span>{selected.length} legajos seleccionados</span>
            <Button
              disabled={busy || filas.isFetching || !selected.length || !fecha}
              onClick={() => run(() => liquidar(false))}
            >
              Previsualizar
            </Button>
            {canGenerate && (
              <Button
                disabled={
                  busy || filas.isFetching || !selected.length || !fecha
                }
                onClick={() => setConfirm('generar')}
              >
                Generar recibos
              </Button>
            )}
          </div>
          <DataGrid
            label="Legajos para liquidar"
            rows={rows}
            columns={columns.map((column) => ({
              ...column,
              sortable: false,
              filterable: false,
            }))}
            showFilterButton={false}
            getRowId={(r) => r.idLegajo}
            processingMode="server"
            rowCount={filas.data?.total ?? 0}
            paginationModel={pagination}
            onPaginationModelChange={(p) => {
              zip.reset();
              setPagination(p);
              setSelection({ type: 'include', ids: [] });
            }}
            search={buscar}
            onSearchChange={(v) => {
              setBuscar(v);
              reset();
            }}
            loading={filas.isFetching || busy}
            error={filas.isError ? errorMessage(filas.error) : null}
            onRetry={() => void filas.refetch()}
            checkboxSelection
            selectionMode="multiple"
            selectAll="page"
            pageSizeOptions={[10, 25, 50, 100]}
            selectionModel={selection}
            onSelectionModelChange={setSelection}
            isRowSelectable={(r) => r.seleccionable}
            rowActions={[
              {
                id: 'ver',
                label: 'Ver recibo',
                visible: (r) => !!r.idRecibo && canConsultarRecibos,
                onClick: (r) => setPreview({ id: r.idRecibo! }),
              },
              {
                id: 'corregir',
                label: 'Corregir novedades y recalcular',
                visible: (r) =>
                  !!r.idRecibo && capabilities.data?.corregirNovedades === true,
                disabled: () => busy,
                onClick: (r) =>
                  run(async () =>
                    setEditor(
                      draftOf(await api.novedades(c, r.idLegajo), fecha),
                    ),
                  ),
              },
            ]}
          />
        </>
      )}
      {result && (
        <div className="novedades-result">
          <h2>Revisión de liquidación</h2>
          {generados.length > 0 && (
            <>
              <Button
                disabled={busy || !canConsultarRecibos}
                onClick={() => descargarZip(generados)}
              >
                Descargar los recibos generados ({generados.length})
              </Button>
              {!canConsultarRecibos && (
                <p>
                  Para descargar el ZIP necesitás permiso de lectura de recibos.
                </p>
              )}
            </>
          )}
          {result.items.map((r) => (
            <div key={r.idLegajo}>
              <strong>
                {rows.find((f) => f.idLegajo === r.idLegajo)?.nombre ??
                  `Legajo ${r.idLegajo}`}
              </strong>{' '}
              · {r.estado} {r.error}
              {r.recibo?.diagnosticos.map((d, i) => (
                <p key={i}>
                  {d.descripcion}: {d.mensaje}
                </p>
              ))}
              {r.recibo?.vista != null &&
                (canConsultarRecibos || !r.recibo.persistido) && (
                  <Button
                    onClick={() =>
                      setPreview(
                        r.recibo!.reciboId
                          ? { id: r.recibo!.reciboId }
                          : { vista: r.recibo!.vista },
                      )
                    }
                  >
                    Ver previsualización
                  </Button>
                )}
            </div>
          ))}
        </div>
      )}
      {preview && (
        <ReciboPreviewDialog
          target={preview}
          busy={busy}
          canRecalculate={canGenerate}
          dirty={!!editor}
          feedback={message}
          onClose={() => setPreview(null)}
          onPdf={pdf}
          onRecalcular={(id) => setConfirm(id)}
        />
      )}
      {confirm !== null && (
        <Modal
          open
          title={
            confirm === 'generar' ? 'Generar recibos' : 'Recalcular recibo'
          }
          onClose={() => setConfirm(null)}
          closeDisabled={busy}
          acceptButton={{
            label: confirm === 'generar' ? 'Generar' : 'Recalcular',
            disabled: busy,
          }}
          onAccept={() =>
            run(async () => {
              if (confirm === 'generar') await liquidar(true);
              else {
                await recibosService.recalcular(confirm);
                setResult(null);
                await invalidate();
              }
              setConfirm(null);
            })
          }
        >
          {message && <Notice>{message}</Notice>}
          <p>
            {confirm === 'generar'
              ? `Se generarán ${selected.length} recibos con los valores revisados.`
              : `Se reemplazarán los detalles del recibo ${confirm} con un nuevo cálculo de los datos almacenados. Los importes pueden cambiar.`}
          </p>
        </Modal>
      )}
      {editor && (
        <NovedadEditor
          key={`${editor.original.idLegajo}-${editor.original.revision}`}
          correction
          initial={editor}
          busy={busy}
          readOnly={false}
          onClose={() => setEditor(null)}
          onSave={async (d, dest) => {
            await action.mutateAsync(async () => {
              const res = await api.corregir(c, [toCambio(d)]);
              const error = res.items.find((i) => i.estado === 'error');
              if (error) {
                setMessage(error.error ?? 'No se pudo corregir.');
                throw new Error('Corrección rechazada');
              }
              await invalidate();
              setResult(null);
              if (dest === 'stay')
                setEditor(
                  draftOf(await api.novedades(c, d.original.idLegajo), fecha),
                );
              else if (dest === 'new') {
                const next = rows.find(
                  (r) =>
                    r.idRecibo &&
                    r.idLegajo !== d.original.idLegajo &&
                    r.idLegajo > d.original.idLegajo,
                );
                if (next)
                  setEditor(
                    draftOf(await api.novedades(c, next.idLegajo), fecha),
                  );
                else {
                  setEditor(null);
                  setMessage(
                    'No hay más recibos en esta página para corregir.',
                  );
                }
              } else setEditor(null);
            });
          }}
        />
      )}
    </section>
  );
}
