import { Select } from '@/components/ui/Select';
import { useEffect, useState } from 'react';
import {
  DataGrid,
  type DataGridColumn,
  type DataGridSelectionModel,
} from '@/components/ui/DataGrid';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { DataGridSkeleton } from '@/components/ui/Skeleton';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { errorMessage } from '@/services/http/ApiError';
import { SelectionSearch } from '@/components/ui/SelectionSearch';
import { useNovedades } from './hooks';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';

import { descargar } from '@/services/http/downloadFile';

import {
  draftOf,
  type Fila,
  type Draft,
  type Resultado,
  type RevisionImportacion,
  type Cambio,
} from './types';
import { toCambio } from './schema';
import { NovedadEditor } from './Editor';
import './novedades.css';
export function NovedadesPage() {
  const permissions = usePermissions();
  const canRead = permissions.can('novedades:read');
  const canWrite = canRead && permissions.can('novedades:write');
  const now = new Date();
  const [mes, setMes] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [tipo, setTipo] = useState('');
  const [empresa, setEmpresa] = useState(0);
  const [empresaBuscar, setEmpresaBuscar] = useState('');
  const [fechas, setFechas] = useState<Record<number, string>>({});
  const fecha = fechas[empresa] ?? '';
  const periodo = mes ? mes.slice(5, 7) + mes.slice(0, 4) : '';
  const contexto = {
    idEmpresa: empresa,
    periodo,
    idTipoLiquidacion: Number(tipo),
  };
  const [buscar, setBuscar] = useState('');
  const [convenio, setConvenio] = useState('');
  const [estado, setEstado] = useState('');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [selection, setSelection] = useState<DataGridSelectionModel>({
    type: 'include',
    ids: [],
  });
  const ids = selection.type === 'include' ? selection.ids.map(Number) : [];
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const dirty = Object.keys(drafts).length > 0;
  const [concepto, setConcepto] = useState('');
  const [vista, setVista] = useState('legajo');
  const [editor, setEditor] = useState<{
    draft: Draft;
    readOnly: boolean;
    key: number;
  } | null>(null);
  const [baja, setBaja] = useState<Fila | null>(null);
  const [feedback, setFeedback] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [revision, setRevision] = useState<RevisionImportacion | null>(null);
  const [masivo, setMasivo] = useState(false);
  const [cantidad, setCantidad] = useState('');
  const [importe, setImporte] = useState('');
  const [pegar, setPegar] = useState(false);
  const [texto, setTexto] = useState('');
  const [pegado, setPegado] = useState<Draft[] | null>(null);
  const q = useNovedades(
    contexto,
    pagination.page + 1,
    pagination.pageSize,
    buscar,
    convenio,
    estado,
    empresaBuscar,
    canRead,
  );
  const busy =
    q.quitar.isPending ||
    q.guardar.isPending ||
    q.importar.isPending ||
    q.plantilla.isPending;
  const rows = q.filas.data?.items ?? [];
  const formulas = [
    ...new Map(
      rows.flatMap((r) => r.requeridas).map((f) => [f.id, f]),
    ).values(),
  ];
  const blocked = busy || dirty;
  useEffect(() => {
    useEmpresaContextStore.getState().bloquearSeleccion(blocked);
    return () => useEmpresaContextStore.getState().bloquearSeleccion(false);
  }, [blocked]);
  const selected = rows.filter(
    (r) => ids.includes(r.idLegajo) && !r.idRecibo && r.errores.length === 0,
  );
  useEffect(() => {
    if (
      !dirty &&
      !busy &&
      q.filas.data &&
      pagination.page > 0 &&
      pagination.page * pagination.pageSize >= q.filas.data.total
    )
      setPagination((p) => ({
        ...p,
        page: Math.max(0, Math.ceil(q.filas.data!.total / p.pageSize) - 1),
      }));
  }, [q.filas.data, dirty, busy, pagination.page, pagination.pageSize]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  useEffect(() => {
    if (!blocked) return;
    const guard = (event: MouseEvent) => {
      const target = event.target;
      const link = target instanceof Element ? target.closest('a[href]') : null;
      if (link && !link.getAttribute('href')?.startsWith('#')) {
        event.preventDefault();
        event.stopPropagation();
        setFeedback(
          'Guardá o descartá los cambios antes de salir de Novedades.',
        );
      }
    };
    document.addEventListener('click', guard, true);
    return () => document.removeEventListener('click', guard, true);
  }, [blocked]);
  const changeContext = (fn: () => void) => {
    if (blocked) return;
    fn();
    setSelection({ type: 'include', ids: [] });
    setPagination((p) => ({ ...p, page: 0 }));
    setResultados([]);
    setConcepto('');
  };
  const getDraft = (r: Fila) => drafts[r.idLegajo] ?? draftOf(r, fecha);
  const patch = (r: Fila, fn: (d: Draft) => Draft) => {
    if (!canWrite || busy || r.idRecibo || r.errores.length) return;
    setDrafts((old) => ({
      ...old,
      [r.idLegajo]: fn(old[r.idLegajo] ?? draftOf(r, fecha)),
    }));
  };
  const detailPatch = (
    r: Fila,
    id: number,
    key: 'cantidad' | 'importe',
    value: string,
  ) =>
    patch(r, (d) => ({
      ...d,
      quitarFormulas: d.quitarFormulas.filter((x) => x !== id),
      detalles: {
        ...d.detalles,
        [id]: {
          cantidad: d.detalles[id]?.cantidad ?? '',
          importe: d.detalles[id]?.importe ?? '',
          observaciones: d.detalles[id]?.observaciones ?? '',
          [key]: value,
        },
      },
    }));
  const save = async (changes: Cambio[]) => {
    setFeedback('');
    const res = await q.guardar.mutateAsync(changes);
    setResultados(res.items);
    setDrafts((old) =>
      Object.fromEntries(
        Object.entries(old).filter(
          ([id]) =>
            !res.items.some(
              (x) => x.idLegajo === Number(id) && x.estado === 'guardado',
            ),
        ),
      ),
    );
    return res;
  };
  const saveDrafts = async () => {
    try {
      await save(Object.values(drafts).map(toCambio));
    } catch (e) {
      setFeedback(
        e instanceof Error && e.name === 'ZodError'
          ? 'Revisá números, importes y fecha de pago antes de guardar.'
          : errorMessage(e),
      );
    }
  };
  const input = (
    r: Fila,
    key: 'diasTrabajados' | 'horasTrabajadas' | 'diasVacaciones',
    label: string,
  ) => (
    <input
      aria-label={`${label} ${r.numero}`}
      inputMode="decimal"
      value={getDraft(r)[key]}
      disabled={!canWrite || busy || !!r.idRecibo || r.errores.length > 0}
      onChange={(e) => patch(r, (d) => ({ ...d, [key]: e.target.value }))}
    />
  );
  const columns: DataGridColumn<Fila>[] = [
    {
      field: 'numero',
      header: 'Legajo',
      getValue: (r: Fila) => r.numero,
      width: 90,
    },
    {
      field: 'nombre',
      header: 'Apellido y nombre',
      getValue: (r: Fila) => r.nombre,
      width: 220,
    },
    {
      field: 'dias',
      header: 'Días',
      getValue: (r: Fila) => r.diasTrabajados,
      render: (r: Fila) => input(r, 'diasTrabajados', 'Días'),
      width: 105,
    },
    {
      field: 'horas',
      header: 'Horas',
      getValue: (r: Fila) => r.horasTrabajadas,
      render: (r: Fila) => input(r, 'horasTrabajadas', 'Horas'),
      width: 105,
    },
    {
      field: 'vacaciones',
      header: 'Vacaciones',
      getValue: (r: Fila) => r.diasVacaciones,
      render: (r: Fila) => input(r, 'diasVacaciones', 'Vacaciones'),
      width: 110,
    },
    ...(vista === 'concepto' && concepto
      ? (['cantidad', 'importe'] as const).map((key) => ({
          field: key,
          header: key === 'cantidad' ? 'Cantidad' : 'Importe',
          width: 145,
          getValue: (r: Fila) =>
            r.detalles.find((x) => x.idFormula === Number(concepto))?.[key],
          render: (r: Fila) =>
            r.requeridas.some((f) => f.id === Number(concepto)) ? (
              <input
                aria-label={`${key} ${r.numero}`}
                inputMode="decimal"
                disabled={!canWrite || busy || r.errores.length > 0}
                value={getDraft(r).detalles[Number(concepto)]?.[key] ?? ''}
                placeholder="Pendiente"
                onChange={(e) =>
                  detailPatch(r, Number(concepto), key, e.target.value)
                }
              />
            ) : (
              <span>No aplica</span>
            ),
        }))
      : []),
    {
      field: 'estado',
      header: 'Situación',
      width: 210,
      getValue: (r: Fila) =>
        r.errores.length
          ? 'Con errores'
          : r.idRecibo
            ? 'Recibo generado'
            : r.pendientes
              ? `${r.pendientes} novedades pendientes`
              : 'Sin novedades pendientes',
      render: (r: Fila) => (
        <span>
          {drafts[r.idLegajo] ? 'Cambios sin guardar · ' : ''}
          {r.errores.length
            ? 'Con errores'
            : r.idRecibo
              ? 'Recibo generado'
              : r.pendientes
                ? `${r.pendientes} pendientes`
                : 'Sin novedades pendientes'}
        </span>
      ),
    },
  ].map((c) => ({
    ...c,
    sortable: false,
    filterable: false,
    searchable: false,
  }));
  if (permissions.isPending) return <DataGridSkeleton />;
  if (!canRead)
    return (
      <Notice>
        No tenés acceso a novedades.
        {permissions.isError && (
          <Button onClick={() => void permissions.refetch()}>
            Reintentar permisos
          </Button>
        )}
      </Notice>
    );
  return (
    <section className="novedades-work">
      <header>
        <h1>Novedades</h1>
        <p>Cargá y revisá las novedades de cada empresa.</p>
      </header>
      <div className="novedades-context">
        <label>
          Período
          <input
            type="month"
            value={mes}
            disabled={blocked}
            onChange={(e) => changeContext(() => setMes(e.target.value))}
          />
        </label>
        <label>
          Tipo de liquidación
          <Select
            value={tipo}
            disabled={blocked || q.tipos.isPending}
            onChange={(e) => changeContext(() => setTipo(e.target.value))}
          >
            <option value="">Seleccionar</option>
            {q.tipos.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {q.tipos.isError && (
        <Notice>
          No se pudieron cargar los tipos de liquidación.
          <Button onClick={() => void q.tipos.refetch()}>Reintentar</Button>
        </Notice>
      )}
      {feedback && <Notice>{feedback}</Notice>}
      <div className="novedades-layout">
        <aside className="novedades-empresas">
          <h2>Empresas</h2>
          <SelectionSearch
            label="Buscar empresa"
            value={empresaBuscar}
            onChange={setEmpresaBuscar}
            disabled={busy}
          />
          {q.empresas.isPending && tipo && (
            <p role="status">Cargando empresas…</p>
          )}
          {q.empresas.isError && (
            <Notice>
              No se pudieron cargar las empresas.
              <Button onClick={() => void q.empresas.refetch()}>
                Reintentar
              </Button>
            </Notice>
          )}
          {!tipo && <p>Seleccioná el tipo de liquidación.</p>}
          {q.empresas.data?.length === 0 && <p>No se encontraron empresas.</p>}
          {q.empresas.data?.map((e) => (
            <button
              className="novedades-empresa"
              key={e.id}
              aria-pressed={empresa === e.id}
              disabled={blocked}
              onClick={() =>
                changeContext(() => {
                  setEmpresa(e.id);
                  setConvenio('');
                  setBuscar('');
                  setEstado('');
                })
              }
            >
              <strong>{e.nombre}</strong>
              <span>
                {e.legajos} legajos · {e.conNovedades} con novedades ·{' '}
                {e.recibos} con recibo
              </span>
            </button>
          ))}
        </aside>
        <div className="novedades-main">
          {!empresa ? (
            <p>Elegí una empresa para comenzar.</p>
          ) : (
            <>
              <h2>
                {q.empresas.data?.find((e) => e.id === empresa)?.nombre ??
                  `Empresa ${empresa}`}
              </h2>
              <p>
                {q.filas.data?.conPendientes ?? 0} con novedades pendientes ·{' '}
                {q.filas.data?.conErrores ?? 0} con errores de configuración ·{' '}
                {q.filas.data?.conRecibo ?? 0} con recibo (según búsqueda y
                convenio).
              </p>
              <div className="novedades-context">
                <label>
                  Fecha de pago
                  <input
                    type="date"
                    value={fecha}
                    disabled={blocked}
                    onChange={(e) => {
                      setFechas((f) => ({ ...f, [empresa]: e.target.value }));
                    }}
                  />
                </label>
                <label>
                  Convenio
                  <Select
                    value={convenio}
                    disabled={blocked}
                    onChange={(e) =>
                      changeContext(() => setConvenio(e.target.value))
                    }
                  >
                    <option value="">Todos</option>
                    {q.convenios.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Select>
                </label>
                <label>
                  Situación
                  <Select
                    value={estado}
                    disabled={blocked}
                    onChange={(e) =>
                      changeContext(() => setEstado(e.target.value))
                    }
                  >
                    <option value="">Todos</option>
                    <option value="pendientes">Con novedades pendientes</option>
                    <option value="errores">Con errores</option>
                    <option value="generados">Con recibo</option>
                    <option value="sin-recibo">Sin recibo</option>
                  </Select>
                </label>
              </div>
              {q.convenios.isError && (
                <Notice>
                  No se pudieron cargar los convenios.
                  <Button onClick={() => void q.convenios.refetch()}>
                    Reintentar
                  </Button>
                </Notice>
              )}
              <SelectionSearch
                label="Buscar legajo, nombre o CUIL"
                value={buscar}
                disabled={blocked}
                onChange={(v) => changeContext(() => setBuscar(v))}
              />
              <div className="novedades-tools">
                <label>
                  Vista
                  <Select
                    value={vista}
                    onChange={(e) => setVista(e.target.value)}
                    disabled={busy}
                  >
                    <option value="legajo">Por legajo</option>
                    <option value="concepto">Por concepto</option>
                  </Select>
                </label>
                {vista === 'concepto' && (
                  <label>
                    Concepto
                    <Select
                      value={concepto}
                      disabled={busy}
                      onChange={(e) => setConcepto(e.target.value)}
                    >
                      <option value="">Seleccionar concepto</option>
                      {formulas.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.codigo} · {f.descripcion}
                        </option>
                      ))}
                    </Select>
                  </label>
                )}
                {canWrite && (
                  <>
                    <Button
                      disabled={busy || !dirty}
                      onClick={() => void saveDrafts()}
                    >
                      Guardar novedades ({Object.keys(drafts).length})
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy || !dirty}
                      onClick={() => {
                        setDrafts({});
                        void q.filas.refetch();
                      }}
                    >
                      Deshacer
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy || !concepto || !selected.length}
                      onClick={() => setMasivo(true)}
                    >
                      Aplicar a seleccionados
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy || !concepto}
                      onClick={() => {
                        setTexto('');
                        setPegado(null);
                        setPegar(true);
                      }}
                    >
                      Pegar desde Excel
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  disabled={blocked || q.filas.isFetching}
                  onClick={() => void q.filas.refetch()}
                >
                  Refrescar
                </Button>
              </div>
              {dirty && (
                <Notice tone="info">
                  Hay cambios sin guardar. Guardalos o usá Deshacer antes de
                  cambiar de empresa, filtrar o liquidar.
                </Notice>
              )}
              <DataGrid
                label="Novedades por legajo"
                rows={rows}
                columns={columns}
                getRowId={(r) => r.idLegajo}
                processingMode="server"
                rowCount={q.filas.data?.total ?? 0}
                paginationModel={pagination}
                onPaginationModelChange={(p) => {
                  if (!blocked) {
                    setPagination(p);
                    setSelection({ type: 'include', ids: [] });
                  }
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                rowHeight={48}
                showSearch={false}
                showFilterButton={false}
                loading={q.filas.isFetching}
                error={q.filas.isError ? errorMessage(q.filas.error) : null}
                onRetry={() => void q.filas.refetch()}
                selectionMode="multiple"
                isRowSelectable={(r) =>
                  canWrite && !r.idRecibo && r.errores.length === 0
                }
                checkboxSelection
                selectAll="page"
                selectionModel={selection}
                onSelectionModelChange={(m) => {
                  if (!busy) setSelection(m);
                }}
                rowActions={[
                  {
                    id: 'ver',
                    label: canWrite ? 'Editar / Ver' : 'Ver',
                    disabled: (r) => busy || r.errores.length > 0,
                    onClick: (r) =>
                      setEditor({
                        draft: getDraft(r),
                        readOnly: !canWrite || !!r.idRecibo,
                        key: Date.now(),
                      }),
                  },
                  {
                    id: 'quitar',
                    label: 'Quitar',
                    visible: (r) =>
                      canWrite && r.idNovedad !== null && r.idRecibo === null,
                    disabled: () => blocked,
                    onClick: (r) => setBaja(r),
                  },
                ]}
              />
              <p>
                Las novedades ya liquidadas son de solo lectura. Su corrección y
                recálculo se realizan desde Liquidaciones, con permisos de ambos
                módulos.
              </p>
              <div className="novedades-tools">
                {canWrite && (
                  <>
                    <Button
                      variant="ghost"
                      disabled={blocked || !convenio}
                      onClick={async () => {
                        try {
                          descargar(
                            await q.plantilla.mutateAsync(Number(convenio)),
                            'Novedades.xlsx',
                          );
                        } catch (e) {
                          setFeedback(errorMessage(e));
                        }
                      }}
                    >
                      Descargar plantilla
                    </Button>
                    <label className="novedades-file">
                      Revisar Excel
                      <input
                        type="file"
                        accept=".xlsx"
                        disabled={blocked || !convenio || !fecha}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file)
                            try {
                              setRevision(
                                await q.importar.mutateAsync({
                                  fecha,
                                  convenio: Number(convenio),
                                  file,
                                }),
                              );
                            } catch (err) {
                              setFeedback(errorMessage(err));
                            }
                        }}
                      />
                    </label>
                  </>
                )}
              </div>
              <p className="novedades-help">
                Para Excel, seleccioná un convenio y la fecha de pago. Una celda
                vacía conserva el dato existente; cero es una carga explícita.
                Los importes cero conservan la interpretación de la fórmula.
              </p>
              {resultados.length > 0 && (
                <div role="status">
                  <h3>Resultado del guardado</h3>
                  {resultados.map((r) => (
                    <p key={r.idLegajo}>
                      Legajo{' '}
                      {rows.find((x) => x.idLegajo === r.idLegajo)?.numero ??
                        r.idLegajo}
                      : {r.estado}. {r.error}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {editor && (
        <NovedadEditor
          key={editor.key}
          initial={editor.draft}
          busy={busy}
          readOnly={editor.readOnly}
          onClose={() => setEditor(null)}
          onSave={async (d, dest) => {
            const res = await save([toCambio(d)]);
            if (res.items[0]?.estado !== 'guardado') throw new Error('save');
            const fresh = await q.filas.refetch();
            const current = fresh.data?.items.find(
              (r) => r.idLegajo === d.original.idLegajo,
            );
            if (dest === 'close') setEditor(null);
            else if (dest === 'new') {
              const next = fresh.data?.items.find(
                (r) => r.idLegajo !== d.original.idLegajo && !r.idNovedad,
              );
              setEditor(
                next
                  ? {
                      draft: draftOf(next, fecha),
                      readOnly: false,
                      key: Date.now(),
                    }
                  : null,
              );
            } else if (current)
              setEditor({
                draft: draftOf(current, fecha),
                readOnly: false,
                key: Date.now(),
              });
          }}
        />
      )}
      {baja && (
        <Modal
          open
          title="Quitar novedades"
          onClose={() => setBaja(null)}
          closeDisabled={busy}
          acceptButton={{ label: 'Quitar', disabled: busy }}
          onAccept={async () => {
            try {
              const result = await q.quitar.mutateAsync({
                id: baja.idLegajo,
                revision: baja.revision,
              });
              setResultados([result]);
              if (result.estado === 'eliminado') setBaja(null);
            } catch (e) {
              setFeedback(errorMessage(e));
            }
          }}
        >
          <p>
            Se quitarán la cabecera y los detalles de {baja.nombre} para este
            período y tipo de liquidación. Sus recibos guardados permanecerán
            sin cambios.
          </p>
        </Modal>
      )}
      {masivo && (
        <Modal
          open
          title="Aplicar novedad"
          onClose={() => setMasivo(false)}
          acceptButton={{ label: 'Aplicar al borrador' }}
          onAccept={() => {
            try {
              const changes = selected
                .filter((r) =>
                  r.requeridas.some((f) => f.id === Number(concepto)),
                )
                .map((r) => {
                  const d = getDraft(r);
                  const updated = {
                    ...d,
                    quitarFormulas: d.quitarFormulas.filter(
                      (id) => id !== Number(concepto),
                    ),
                    detalles: {
                      ...d.detalles,
                      [Number(concepto)]: {
                        cantidad,
                        importe,
                        observaciones:
                          d.detalles[Number(concepto)]?.observaciones ?? '',
                      },
                    },
                  };
                  toCambio(updated);
                  return updated;
                });
              setDrafts((old) => ({
                ...old,
                ...Object.fromEntries(
                  changes.map((d) => [d.original.idLegajo, d]),
                ),
              }));
              setMasivo(false);
            } catch {
              setFeedback('Revisá los valores y la fecha de pago.');
            }
          }}
        >
          <p>
            Concepto{' '}
            {formulas.find((f) => f.id === Number(concepto))?.descripcion}. Se
            aplicará a{' '}
            {
              selected.filter((r) =>
                r.requeridas.some((f) => f.id === Number(concepto)),
              ).length
            }{' '}
            legajos seleccionados donde corresponde.
          </p>
          <div className="novedades-context">
            <label>
              Cantidad
              <input
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </label>
            <label>
              Importe
              <input
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
            </label>
            <Button
              variant="ghost"
              onClick={() => {
                setCantidad('0');
                setImporte('');
              }}
            >
              Confirmar sin novedad
            </Button>
          </div>
        </Modal>
      )}
      {pegar && (
        <Modal
          open
          title="Pegar valores desde Excel"
          size="large"
          onClose={() => setPegar(false)}
          acceptButton={{ label: pegado ? 'Aplicar al borrador' : 'Revisar' }}
          onAccept={() => {
            if (pegado) {
              setDrafts((old) => ({
                ...old,
                ...Object.fromEntries(
                  pegado.map((d) => [d.original.idLegajo, d]),
                ),
              }));
              setPegar(false);
              return;
            }
            try {
              const seen = new Set<number>();
              const parsed = texto
                .trim()
                .split(/\r?\n/)
                .map((line) => {
                  const cells = line.split('\t');
                  if (cells.length < 2 || cells.length > 3) throw new Error();
                  const matches = rows.filter(
                    (r) => String(r.numero) === cells[0]!.trim(),
                  );
                  if (
                    matches.length !== 1 ||
                    seen.has(matches[0]!.idLegajo) ||
                    !matches[0]!.requeridas.some(
                      (f) => f.id === Number(concepto),
                    )
                  )
                    throw new Error();
                  const r = matches[0]!;
                  seen.add(r.idLegajo);
                  const d = getDraft(r);
                  const next = {
                    ...d,
                    quitarFormulas: d.quitarFormulas.filter(
                      (id) => id !== Number(concepto),
                    ),
                    detalles: {
                      ...d.detalles,
                      [Number(concepto)]: {
                        cantidad: cells[1]!.trim(),
                        importe: cells[2]?.trim() ?? '',
                        observaciones:
                          d.detalles[Number(concepto)]?.observaciones ?? '',
                      },
                    },
                  };
                  toCambio(next);
                  return next;
                });
              setPegado(parsed);
            } catch {
              setFeedback(
                'Pegado inválido: usá legajos únicos de esta página, concepto aplicable y números válidos.',
              );
            }
          }}
        >
          <p>
            Columnas sin encabezado: Legajo, Cantidad e Importe (opcional),
            separadas por tabulaciones. Se revisa sobre la página visible.
          </p>
          <textarea
            aria-label="Valores desde Excel"
            rows={8}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setPegado(null);
            }}
          />
          {pegado && (
            <ul>
              {pegado.map((d) => (
                <li key={d.original.idLegajo}>
                  {d.original.nombre}: cantidad{' '}
                  {d.detalles[Number(concepto)]!.cantidad || 'vacía'}, importe{' '}
                  {d.detalles[Number(concepto)]!.importe || 'vacío'}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
      {revision && (
        <Modal
          open
          title="Revisión de importación"
          size="large"
          onClose={() => setRevision(null)}
          closeDisabled={busy}
          acceptButton={{
            label: 'Confirmar y guardar',
            disabled:
              busy ||
              revision.errores.length > 0 ||
              revision.cambios.length === 0,
          }}
          onAccept={async () => {
            try {
              await save(revision.cambios);
              setRevision(null);
            } catch (e) {
              setFeedback(errorMessage(e));
            }
          }}
        >
          <p>
            La revisión todavía no guardó datos. Las celdas vacías conservan los
            valores existentes.
          </p>
          {revision.errores.map((e, i) => (
            <Notice key={i}>{e}</Notice>
          ))}
          {revision.cambios.map((c) => {
            const old = revision.originales.find(
              (r) => r.idLegajo === c.idLegajo,
            );
            return (
              <div key={c.idLegajo}>
                <h3>
                  {old?.nombre} · {old?.idNovedad ? 'Actualizar' : 'Crear'}
                </h3>
                <p>
                  Días: {old?.diasTrabajados ?? 'vacío'} →{' '}
                  {c.diasTrabajados ?? 'vacío'} · Horas:{' '}
                  {old?.horasTrabajadas ?? 'vacío'} →{' '}
                  {c.horasTrabajadas ?? 'vacío'}
                </p>
                {c.detalles.map((d) => (
                  <p key={d.idFormula}>
                    Fórmula {d.idFormula}: cantidad{' '}
                    {old?.detalles.find((x) => x.idFormula === d.idFormula)
                      ?.cantidad ?? 'vacía'}{' '}
                    → {d.cantidad ?? 'vacía'}; importe{' '}
                    {old?.detalles.find((x) => x.idFormula === d.idFormula)
                      ?.importe ?? 'vacío'}{' '}
                    → {d.importe ?? 'vacío'}
                  </p>
                ))}
              </div>
            );
          })}
        </Modal>
      )}
    </section>
  );
}
