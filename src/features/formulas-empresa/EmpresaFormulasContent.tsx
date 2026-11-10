import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DataGrid, type DataGridColumn } from '@/components/ui/DataGrid';
import { DataGridSkeleton } from '@/components/ui/Skeleton';
import { errorMessage } from '@/services/http/ApiError';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';
import type { Empresa } from '@/features/empresas/types/empresa';
import { useConfiguracionFormulas } from './hooks';
import {
  formulasEmpresaApi,
  type Agrupacion,
  type Exclusion,
  type Publicacion,
} from './service';
import {
  AgrupacionEditor,
  ExclusionEditor,
  FormulaEmpresaEditor,
} from './ConfiguracionEditors';
import './formulas-empresa.css';
import '@/features/formulas/pages/formulas.css';

type Editor =
  | { tipo: 'grupo'; row?: Agrupacion; readonly: boolean }
  | { tipo: 'exclusion'; row?: Exclusion; readonly: boolean }
  | { tipo: 'formula'; row?: Publicacion; origen?: number; readonly: boolean };
const grupoColumns: DataGridColumn<Agrupacion>[] = [
  {
    field: 'descripcion',
    header: 'Descripción',
    getValue: (r: Agrupacion) => r.descripcion,
  },
  { field: 'orden', header: 'Posición', getValue: (r: Agrupacion) => r.orden },
  {
    field: 'formulas',
    header: 'Fórmulas',
    getValue: (r: Agrupacion) => r.formulas.length,
  },
  {
    field: 'desde',
    header: 'Desde',
    getValue: (r: Agrupacion) => r.periodoDesde.slice(0, 7),
  },
  {
    field: 'hasta',
    header: 'Hasta',
    getValue: (r: Agrupacion) => r.periodoHasta?.slice(0, 7) ?? 'Sin límite',
  },
  {
    field: 'activa',
    header: 'Activa',
    getValue: (r: Agrupacion) => (r.activa ? 'Sí' : 'No'),
  },
].map((c) => ({ ...c, sortable: false, filterable: false, searchable: false }));
const propiasColumns: DataGridColumn<Publicacion>[] = [
  {
    field: 'codigo',
    header: 'Código',
    getValue: (r: Publicacion) => r.publicacion?.formula.codigo,
  },
  {
    field: 'descripcion',
    header: 'Descripción',
    getValue: (r: Publicacion) => r.publicacion?.descripcionCompleta,
  },
  {
    field: 'tipo',
    header: 'Origen',
    getValue: (r: Publicacion) =>
      r.idFormulaCentralOrigen ? 'Reemplazo de central' : 'Propia de empresa',
  },
  {
    field: 'revision',
    header: 'Revisión',
    getValue: (r: Publicacion) => r.revision,
  },
  {
    field: 'desde',
    header: 'Desde',
    getValue: (r: Publicacion) => r.periodoDesde?.slice(0, 7),
  },
  {
    field: 'activo',
    header: 'Activa',
    getValue: (r: Publicacion) => (r.publicacion?.formula.activo ? 'Sí' : 'No'),
  },
].map((c) => ({ ...c, sortable: false, filterable: false, searchable: false }));
export function EmpresaFormulasContent({
  empresa,
  canWrite,
}: {
  empresa: Pick<Empresa, 'id' | 'nombre'>;
  canWrite: boolean;
}) {
  const revision = useAuthStore((s) => s.revision);
  const cfg = useConfiguracionFormulas(empresa.id);
  const [tab, setTab] = useState<'grupos' | 'formulas' | 'exclusiones'>(
    'grupos',
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  useEffect(() => {
    useEmpresaContextStore.getState().bloquearSeleccion(editor !== null);
    return () => useEmpresaContextStore.getState().bloquearSeleccion(false);
  }, [editor]);
  const [key, setKey] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [centralId, setCentralId] = useState('');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const central = useQuery({
    queryKey: ['formulas-empresa', revision, empresa.id, 'central', centralId],
    queryFn: ({ signal }) =>
      formulasEmpresaApi.central(empresa.id, Number(centralId), signal),
    enabled: !!centralId && tab === 'formulas',
    refetchOnWindowFocus: false,
    retry: false,
  });
  const open = (next: Editor) => {
    cfg.guardarGrupo.reset();
    cfg.publicar.reset();
    cfg.guardarExclusion.reset();
    setKey((k) => k + 1);
    setEditor(next);
    setFeedback('');
  };
  const refreshed = async () => {
    if (editor?.tipo === 'grupo' && editor.row) {
      const r = await cfg.agrupaciones.refetch();
      const row = r.data?.find((x) => x.id === editor.row!.id);
      if (row) open({ ...editor, row });
      else
        setFeedback(
          'No se pudo recuperar el registro. Se conserva el borrador.',
        );
    } else if (editor?.tipo === 'formula' && editor.row && !editor.origen) {
      const r = await cfg.propias.refetch();
      const row = r.data?.find((x) => x.id === editor.row!.id);
      if (row) open({ ...editor, row });
      else
        setFeedback(
          'No se pudo recuperar el registro. Se conserva el borrador.',
        );
    } else if (editor?.tipo === 'exclusion' && editor.row) {
      const r = await cfg.exclusiones.refetch();
      const row = r.data?.find((x) => x.id === editor.row!.id);
      if (row) open({ ...editor, row });
      else
        setFeedback(
          'No se pudo recuperar el registro. Se conserva el borrador.',
        );
    } else {
      setKey((k) => k + 1);
      cfg.guardarGrupo.reset();
      cfg.publicar.reset();
      cfg.guardarExclusion.reset();
    }
  };
  const saved = (
    destination: 'stay' | 'close' | 'new',
    next: Editor,
    nuevo: Editor,
  ) => {
    setFeedback(
      'Configuración guardada correctamente. Los recibos anteriores conservan su presentación.',
    );
    setKey((k) => k + 1);
    setEditor(
      destination === 'close' ? null : destination === 'new' ? nuevo : next,
    );
  };
  const exclusionColumns: DataGridColumn<Exclusion>[] = [
    {
      field: 'formula',
      header: 'Fórmula central',
      getValue: (r: Exclusion) =>
        cfg.opciones.data?.find((f) => f.id === r.idFormula)?.descripcion ??
        `Fórmula ${r.idFormula}`,
    },
    {
      field: 'desde',
      header: 'Desde',
      getValue: (r: Exclusion) => r.periodoDesde.slice(0, 7),
    },
    {
      field: 'hasta',
      header: 'Hasta',
      getValue: (r: Exclusion) => r.periodoHasta?.slice(0, 7) ?? 'Sin límite',
    },
    {
      field: 'activa',
      header: 'Exclusión activa',
      getValue: (r: Exclusion) => (r.activa ? 'Sí' : 'No'),
    },
  ].map((c) => ({
    ...c,
    sortable: false,
    filterable: false,
    searchable: false,
  }));
  const toolbar = (
    create: () => void,
    refresh: () => void,
    loading: boolean,
  ) => [
    { id: 'refresh', label: 'Refrescar', disabled: loading, onClick: refresh },
    { id: 'create', label: 'Nuevo', visible: canWrite, onClick: create },
  ];
  const common = {
    processingMode: 'client' as const,
    paginationModel: pagination,
    onPaginationModelChange: setPagination,
    pageSizeOptions: [10, 25, 50, 100],
    showSearch: false,
    showFilterButton: false,
    rowHeight: 48,
  };
  return (
    <>
      <div className="formula-config-content">
        <nav
          className="formula-config-tabs"
          aria-label="Configuración de fórmulas de empresa"
        >
          {(
            [
              ['grupos', 'Agrupaciones'],
              ['formulas', 'Fórmulas propias'],
              ['exclusiones', 'Exclusiones'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={tab === value ? 'primary' : 'ghost'}
              aria-pressed={tab === value}
              disabled={!!editor}
              onClick={() => {
                setTab(value);
                setPagination((p) => ({ ...p, page: 0 }));
              }}
            >
              {label}
            </Button>
          ))}
        </nav>
        {feedback && <p role="status">{feedback}</p>}
        {tab === 'grupos' && (
          <>
            <p>
              Agrupe la presentación sin cambiar el cálculo ni el detalle que se
              exporta.
            </p>
            {cfg.agrupaciones.isPending ? (
              <DataGridSkeleton columns={6} actions />
            ) : (
              <DataGrid
                {...common}
                label="Agrupaciones de fórmulas"
                rows={cfg.agrupaciones.data ?? []}
                columns={grupoColumns}
                getRowId={(r) => r.id}
                loading={cfg.agrupaciones.isFetching}
                error={
                  cfg.agrupaciones.isError
                    ? errorMessage(cfg.agrupaciones.error)
                    : null
                }
                onRetry={() => void cfg.agrupaciones.refetch()}
                emptyMessage="No hay agrupaciones para esta empresa."
                globalActions={toolbar(
                  () => open({ tipo: 'grupo', readonly: false }),
                  () => void cfg.agrupaciones.refetch(),
                  cfg.agrupaciones.isFetching,
                )}
                rowActions={[
                  {
                    id: 'view',
                    label: 'Ver',
                    onClick: (row) =>
                      open({ tipo: 'grupo', row, readonly: true }),
                  },
                  {
                    id: 'edit',
                    label: 'Editar',
                    visible: () => canWrite,
                    onClick: (row) =>
                      open({ tipo: 'grupo', row, readonly: false }),
                  },
                ]}
              />
            )}
          </>
        )}
        {tab === 'formulas' && (
          <>
            <p>
              Las fórmulas propias y los reemplazos se aplican exclusivamente a
              esta empresa.
            </p>
            {canWrite && (
              <div className="formula-config-source">
                <label htmlFor="central-reemplazo">
                  Personalizar una central
                </label>
                <Select
                  id="central-reemplazo"
                  value={centralId}
                  onChange={(e) => setCentralId(e.target.value)}
                >
                  <option value="">Seleccione una fórmula</option>
                  {cfg.opciones.data
                    ?.filter((f) => f.idEmpresa == null)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.codigo} · {f.descripcion}
                      </option>
                    ))}
                </Select>
                <Button
                  disabled={
                    !central.data ||
                    central.isFetching ||
                    central.isError ||
                    !cfg.catalogos.data
                  }
                  onClick={() =>
                    open({
                      tipo: 'formula',
                      row: central.data,
                      origen: Number(centralId),
                      readonly: false,
                    })
                  }
                >
                  Personalizar para esta empresa
                </Button>
              </div>
            )}
            {central.isError && (
              <p role="alert">{errorMessage(central.error)}</p>
            )}
            {cfg.propias.isPending ? (
              <DataGridSkeleton columns={6} actions />
            ) : (
              <DataGrid
                {...common}
                label="Fórmulas propias de empresa"
                rows={cfg.propias.data ?? []}
                columns={propiasColumns}
                getRowId={(r) => r.id}
                loading={cfg.propias.isFetching}
                error={
                  cfg.propias.isError ? errorMessage(cfg.propias.error) : null
                }
                onRetry={() => void cfg.propias.refetch()}
                emptyMessage="No hay fórmulas propias de esta empresa."
                globalActions={toolbar(
                  () => open({ tipo: 'formula', readonly: false }),
                  () => void cfg.propias.refetch(),
                  cfg.propias.isFetching,
                )}
                rowActions={[
                  {
                    id: 'view',
                    label: 'Ver',
                    onClick: (row) =>
                      open({ tipo: 'formula', row, readonly: true }),
                  },
                  {
                    id: 'edit',
                    label: 'Publicar versión',
                    visible: () => canWrite,
                    onClick: (row) =>
                      open({ tipo: 'formula', row, readonly: false }),
                  },
                ]}
              />
            )}
          </>
        )}
        {tab === 'exclusiones' && (
          <>
            <p>
              Las exclusiones dejan de calcular la fórmula central para esta
              empresa durante la vigencia indicada.
            </p>
            {cfg.exclusiones.isPending ? (
              <DataGridSkeleton columns={4} actions />
            ) : (
              <DataGrid
                {...common}
                label="Exclusiones de fórmulas"
                rows={cfg.exclusiones.data ?? []}
                columns={exclusionColumns}
                getRowId={(r) => r.id}
                loading={cfg.exclusiones.isFetching}
                error={
                  cfg.exclusiones.isError
                    ? errorMessage(cfg.exclusiones.error)
                    : null
                }
                onRetry={() => void cfg.exclusiones.refetch()}
                emptyMessage="No hay exclusiones para esta empresa."
                globalActions={toolbar(
                  () => open({ tipo: 'exclusion', readonly: false }),
                  () => void cfg.exclusiones.refetch(),
                  cfg.exclusiones.isFetching,
                )}
                rowActions={[
                  {
                    id: 'view',
                    label: 'Ver',
                    onClick: (row) =>
                      open({ tipo: 'exclusion', row, readonly: true }),
                  },
                  {
                    id: 'edit',
                    label: 'Editar o restaurar',
                    visible: () => canWrite,
                    onClick: (row) =>
                      open({ tipo: 'exclusion', row, readonly: false }),
                  },
                ]}
              />
            )}
          </>
        )}
      </div>
      {editor && (cfg.opciones.isPending || cfg.catalogos.isPending) && (
        <Modal
          open
          title="Cargando configuración"
          onClose={() => setEditor(null)}
          acceptButton={false}
        >
          <DataGridSkeleton columns={3} />
        </Modal>
      )}
      {editor && (cfg.opciones.isError || cfg.catalogos.isError) && (
        <Modal
          open
          title="No se pudo cargar la configuración"
          onClose={() => setEditor(null)}
          acceptButton={false}
        >
          <p role="alert">
            {errorMessage(cfg.opciones.error ?? cfg.catalogos.error)}
          </p>
          <Button
            onClick={() => {
              void cfg.opciones.refetch();
              void cfg.catalogos.refetch();
            }}
          >
            Reintentar
          </Button>
        </Modal>
      )}
      {editor?.tipo === 'grupo' &&
        cfg.opciones.data &&
        !cfg.catalogos.isPending &&
        !cfg.catalogos.isError && (
          <AgrupacionEditor
            key={key}
            initial={editor.row}
            opciones={cfg.opciones.data}
            busy={cfg.guardarGrupo.isPending}
            readOnly={editor.readonly || !canWrite}
            error={cfg.guardarGrupo.error}
            onClose={() => !cfg.guardarGrupo.isPending && setEditor(null)}
            onUndo={() => void refreshed()}
            onSave={async (data, destino) => {
              try {
                const row = await cfg.guardarGrupo.mutateAsync({
                  id: editor.row?.id ?? null,
                  data,
                });
                saved(
                  destino,
                  { tipo: 'grupo', row, readonly: false },
                  { tipo: 'grupo', readonly: false },
                );
              } catch {
                /* Preserve draft. */
              }
            }}
          />
        )}
      {editor?.tipo === 'exclusion' &&
        cfg.opciones.data &&
        !cfg.catalogos.isPending &&
        !cfg.catalogos.isError && (
          <ExclusionEditor
            key={key}
            initial={editor.row}
            opciones={cfg.opciones.data}
            busy={cfg.guardarExclusion.isPending}
            readOnly={editor.readonly || !canWrite}
            error={cfg.guardarExclusion.error}
            onClose={() => !cfg.guardarExclusion.isPending && setEditor(null)}
            onUndo={() => void refreshed()}
            onSave={async (data, destino) => {
              try {
                const row = await cfg.guardarExclusion.mutateAsync({
                  id: editor.row?.id ?? null,
                  data,
                });
                saved(
                  destino,
                  { tipo: 'exclusion', row, readonly: false },
                  { tipo: 'exclusion', readonly: false },
                );
              } catch {
                /* Preserve draft. */
              }
            }}
          />
        )}
      {editor?.tipo === 'formula' &&
        cfg.catalogos.data &&
        !cfg.opciones.isPending &&
        !cfg.opciones.isError && (
          <FormulaEmpresaEditor
            key={key}
            initial={editor.row}
            origen={editor.origen}
            catalogos={cfg.catalogos.data}
            busy={cfg.publicar.isPending}
            readOnly={editor.readonly || !canWrite}
            error={cfg.publicar.error}
            onClose={() => !cfg.publicar.isPending && setEditor(null)}
            onUndo={() => void refreshed()}
            onSave={async (data, destino) => {
              try {
                const row = await cfg.publicar.mutateAsync({
                  id: editor.origen ? null : (editor.row?.id ?? null),
                  data,
                });
                saved(
                  destino,
                  { tipo: 'formula', row, readonly: false },
                  { tipo: 'formula', readonly: false },
                );
              } catch {
                /* Preserve draft. */
              }
            }}
          />
        )}
    </>
  );
}
