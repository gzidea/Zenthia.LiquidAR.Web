import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import {
  SelectionSearch,
  matchesSelection,
} from '@/components/ui/SelectionSearch';
import {
  DataGrid,
  type DataGridColumn,
  type DataGridSelectionModel,
} from '@/components/ui/DataGrid';
import { errorMessage } from '@/services/http/ApiError';
import { useEmpresaActividades, useEmpresaBancos } from '../hooks/useEmpresas';
export interface EmpresaOpcion {
  id: number;
  codigo: string;
  nombre: string;
  abreviacion: string;
}
export function EmpresaSelector({
  kind,
  existing,
  onAdd,
  onClose,
}: {
  kind: 'actividades' | 'bancos';
  existing: number[];
  onAdd: (rows: EmpresaOpcion[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [selected, setSelected] = useState<EmpresaOpcion[]>([]);
  const activities = useEmpresaActividades(kind === 'actividades');
  const banks = useEmpresaBancos(
    pagination.page + 1,
    pagination.pageSize,
    search,
    kind === 'bancos',
  );
  const rows: EmpresaOpcion[] =
    kind === 'actividades'
      ? (activities.data ?? [])
          .map((x) => ({
            id: x.id,
            codigo: x.codigoAfip?.toString() ?? '',
            nombre: x.descripcion ?? '',
            abreviacion: '',
          }))
          .filter((x) => matchesSelection(`${x.codigo} ${x.nombre}`, search))
      : (banks.data?.items ?? []).map((x) => ({
          id: x.id,
          codigo: x.codigoEntidad.toString(),
          nombre: x.denominacion ?? '',
          abreviacion: x.abreviacion ?? '',
        }));
  const query = kind === 'actividades' ? activities : banks;
  const columns: DataGridColumn<EmpresaOpcion>[] = [
    {
      field: 'codigo',
      header: kind === 'actividades' ? 'Código AFIP' : 'Código',
      getValue: (x: EmpresaOpcion) => x.codigo,
    },
    {
      field: 'nombre',
      header: kind === 'actividades' ? 'Descripción' : 'Denominación',
      getValue: (x: EmpresaOpcion) => x.nombre,
    },
    ...(kind === 'bancos'
      ? [
          {
            field: 'abreviacion',
            header: 'Abreviación',
            getValue: (x: EmpresaOpcion) => x.abreviacion,
          },
        ]
      : []),
    {
      field: 'asociada',
      header: 'Estado',
      getValue: (x: EmpresaOpcion) =>
        existing.includes(x.id) ? 'Ya agregada' : '',
    },
  ].map((x) => ({
    ...x,
    sortable: false,
    filterable: false,
    searchable: false,
  }));
  const selection: DataGridSelectionModel = {
    type: 'include',
    ids: selected.map((x) => x.id),
  };
  function select(model: DataGridSelectionModel) {
    if (model.type !== 'include') return;
    const available = new Map([...selected, ...rows].map((x) => [x.id, x]));
    setSelected(
      model.ids.flatMap((id) => {
        const row = available.get(Number(id));
        return row && !existing.includes(row.id) ? [row] : [];
      }),
    );
  }
  const common = {
    label: `Seleccionar ${kind}`,
    rows,
    columns,
    getRowId: (x: EmpresaOpcion) => x.id,
    selectionMode: 'multiple' as const,
    checkboxSelection: true,
    selectAll: 'page' as const,
    selectionModel: selection,
    onSelectionModelChange: select,
    showSearch: false,
    showFilterButton: false,
    loading: query.isFetching,
    error: query.isError ? errorMessage(query.error) : null,
    onRetry: () => void query.refetch(),
    paginationModel: pagination,
    onPaginationModelChange: setPagination,
    pageSizeOptions: [10, 25, 50, 100],
    emptyMessage: 'No hay opciones para mostrar.',
  };
  return (
    <Modal
      open
      title={`Agregar ${kind}`}
      size="large"
      onClose={onClose}
      acceptButton={{
        label: `Agregar seleccionadas (${selected.length})`,
        disabled: selected.length === 0 || query.isFetching || query.isError,
      }}
      onAccept={() => {
        onAdd(selected);
        onClose();
      }}
    >
      <p>
        Marcá las opciones a incorporar. Las ya agregadas no se duplican. Se
        guardarán junto con la empresa.
      </p>
      <SelectionSearch
        label={`Buscar ${kind}`}
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPagination((p) => ({ ...p, page: 0 }));
        }}
      />
      {kind === 'bancos' ? (
        <DataGrid
          {...common}
          processingMode="server"
          rowCount={banks.data?.total ?? 0}
        />
      ) : (
        <DataGrid {...common} processingMode="client" />
      )}
    </Modal>
  );
}
