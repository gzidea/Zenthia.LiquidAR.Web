import { Select } from '@/components/ui/Select';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import {
  DataGrid,
  type DataGridColumn,
  type DataGridSelectionModel,
} from '@/components/ui/DataGrid';
import {
  SelectionSearch,
  matchesSelection,
} from '@/components/ui/SelectionSearch';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { useFormulaCatalog } from '@/features/formulas/hooks/useFormulas';
import { catalogLabel } from '@/features/formulas/types/formula';
import { errorMessage } from '@/services/http/ApiError';
import { reglaService } from './service';
import { campos, type Destino, type Opcion } from './types';
import { useAuthStore } from '@/features/auth/stores/authStore';

export function DestinoSelector({
  existing,
  onAdd,
  onClose,
  centralizada = false,
  reglaId = null,
}: {
  existing: number[];
  onAdd: (rows: Destino[]) => void;
  onClose: () => void;
  centralizada?: boolean;
  reglaId?: number | null;
}) {
  const permissions = usePermissions();
  const revision = useAuthStore((s) => s.revision);
  const [search, setSearch] = useState('');
  const [convenio, setConvenio] = useState('');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [selected, setSelected] = useState<Destino[]>([]);
  const query = useQuery({
    queryKey: [
      'reglas-ajuste',
      revision,
      'disponibles',
      pagination,
      search,
      convenio,
      centralizada,
      reglaId,
    ],
    queryFn: ({ signal }) =>
      reglaService.disponibles(
        pagination.page + 1,
        pagination.pageSize,
        search,
        convenio,
        centralizada,
        reglaId,
        signal,
      ),
    enabled: permissions.can('reglas-ajustes:read'),
  });
  const convenios = useFormulaCatalog(
    'convenios',
    permissions.can('convenios:read'),
  );
  const rows: Destino[] = query.data?.items ?? [];
  const columns: DataGridColumn<Destino>[] = [
    { field: 'codigo', header: 'Código', getValue: (x: Destino) => x.codigo },
    {
      field: 'descripcion',
      header: 'Descripción',
      getValue: (x: Destino) => x.descripcion,
    },
    {
      field: 'convenio',
      header: 'Convenio',
      getValue: (x: Destino) => x.convenioNombre ?? x.convenioId,
    },
    {
      field: 'estado',
      header: 'Estado',
      getValue: (x: Destino) =>
        existing.includes(x.id)
          ? 'Ya agregada'
          : x.activo
            ? 'Activa'
            : 'Inactiva',
    },
  ].map((x) => ({
    ...x,
    sortable: false,
    filterable: false,
    searchable: false,
  }));
  const select = (model: DataGridSelectionModel) => {
    if (model.type !== 'include') return;
    const available = new Map([...selected, ...rows].map((x) => [x.id, x]));
    setSelected(
      model.ids.flatMap((id) => {
        const row = available.get(Number(id));
        return row && !existing.includes(row.id) ? [row] : [];
      }),
    );
  };
  return (
    <Modal
      open
      size="large"
      title="Agregar fórmulas"
      onClose={onClose}
      acceptButton={{
        label: `Agregar seleccionadas (${selected.length})`,
        disabled:
          !selected.length ||
          query.isFetching ||
          query.isError ||
          selected.length + existing.length > 500,
      }}
      onAccept={() => {
        onAdd(selected);
        onClose();
      }}
    >
      <div className="regla-filters">
        <SelectionSearch
          label="Buscar fórmulas"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPagination((p) => ({ ...p, page: 0 }));
          }}
        />
        <label>
          Convenio
          <Select
            value={convenio}
            disabled={!permissions.can('convenios:read') || convenios.isError}
            onChange={(e) => {
              setConvenio(e.target.value);
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
      </div>
      {convenios.isError && <p role="alert">{errorMessage(convenios.error)}</p>}
      <p>
        Seleccioná fórmulas individuales. Máximo 500 destinos; las ya agregadas
        no se duplican.
      </p>
      <DataGrid
        label="Seleccionar fórmulas"
        rows={rows}
        columns={columns}
        getRowId={(x) => x.id}
        processingMode="server"
        rowCount={query.data?.total ?? 0}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        pageSizeOptions={[10, 25, 50, 100]}
        selectionMode="multiple"
        checkboxSelection
        selectAll="page"
        selectionModel={{ type: 'include', ids: selected.map((x) => x.id) }}
        onSelectionModelChange={select}
        showSearch={false}
        showFilterButton={false}
        loading={query.isFetching}
        error={query.isError ? errorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
      />
    </Modal>
  );
}
export const permisoCampo = (campo: string) =>
  campo === 'legajo.id'
    ? 'legajo:read'
    : campo === 'legajo.idEmpresa'
      ? 'empresas:read'
      : ['legajo.idConvenio', 'legajo.idCategoria'].includes(campo)
        ? 'convenios:read'
        : 'auxiliar:read';
export function CondicionSelector({
  campo,
  multiple,
  onAdd,
  onClose,
}: {
  campo: string;
  multiple: boolean;
  onAdd: (rows: Opcion[]) => void;
  onClose: () => void;
}) {
  const permissions = usePermissions();
  const allowed = permissions.can(permisoCampo(campo));
  const [search, setSearch] = useState('');
  const [parent, setParent] = useState('');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [selected, setSelected] = useState<Opcion[]>([]);
  const remote = campo === 'legajo.id';
  const categories = campo === 'legajo.idCategoria';
  const convenios = useFormulaCatalog('convenios', categories && allowed);
  const query = useQuery({
    queryKey: [
      'reglas-ajuste',
      'opciones',
      campo,
      parent,
      remote ? search : '',
      remote ? pagination.page : 0,
    ],
    queryFn: async ({ signal }) =>
      remote
        ? reglaService.legajos(pagination.page + 1, search, signal)
        : {
            items: await reglaService.catalog(campo, parent, signal),
            total: 0,
          },
    enabled: allowed && (!categories || !!parent),
  });
  const rows = remote
    ? (query.data?.items ?? [])
    : (query.data?.items ?? []).filter((x) =>
        matchesSelection(`${x.id} ${x.nombre}`, search),
      );
  const select = (model: DataGridSelectionModel) => {
    if (model.type !== 'include') return;
    const available = new Map([...selected, ...rows].map((x) => [x.id, x]));
    const next = model.ids.flatMap((id) => {
      const row = available.get(Number(id));
      return row ? [row] : [];
    });
    setSelected(multiple ? next : next.slice(-1));
  };
  return (
    <Modal
      open
      size="large"
      title={`Seleccionar ${campos[campo]}`}
      onClose={onClose}
      acceptButton={{
        label: `Aplicar selección (${selected.length})`,
        disabled:
          !selected.length ||
          selected.length > 100 ||
          query.isFetching ||
          query.isError,
      }}
      onAccept={() => {
        onAdd(selected);
        onClose();
      }}
    >
      {!allowed && (
        <p role="alert">No tenés permiso para consultar este catálogo.</p>
      )}
      {categories && (
        <div className="regla-filters">
          <label>
            Convenio
            <Select
              value={parent}
              onChange={(e) => {
                setParent(e.target.value);
                setPagination((p) => ({ ...p, page: 0 }));
              }}
            >
              <option value="">Seleccioná un convenio</option>
              {convenios.data?.map((x) => (
                <option key={x.id} value={x.id}>
                  {catalogLabel(x)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      )}
      {convenios.isError && <p role="alert">{errorMessage(convenios.error)}</p>}
      <SelectionSearch
        label={`Buscar ${campos[campo]}`}
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPagination((p) => ({ ...p, page: 0 }));
        }}
      />
      <DataGrid
        label={`Opciones de ${campos[campo]}`}
        rows={rows}
        columns={[
          {
            field: 'id',
            header:
              campo === 'legajo.modalidadContratacionCodigo'
                ? 'Código ARCA'
                : 'ID',
            getValue: (x) => x.id,
            sortable: false,
          },
          {
            field: 'nombre',
            header: 'Descripción',
            getValue: (x) => x.nombre,
            sortable: false,
          },
        ]}
        getRowId={(x) => x.id}
        {...(remote
          ? {
              processingMode: 'server' as const,
              rowCount: query.data?.total ?? 0,
            }
          : { processingMode: 'client' as const })}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        pageSizeOptions={[25]}
        selectionMode="multiple"
        checkboxSelection
        selectAll="page"
        selectionModel={{ type: 'include', ids: selected.map((x) => x.id) }}
        onSelectionModelChange={select}
        showSearch={false}
        showFilterButton={false}
        loading={query.isFetching}
        error={query.isError ? errorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyMessage={
          categories && !parent
            ? 'Seleccioná primero un convenio.'
            : 'No hay opciones disponibles.'
        }
      />
      {!multiple && <p>Se aplicará una sola opción: la última seleccionada.</p>}
    </Modal>
  );
}
