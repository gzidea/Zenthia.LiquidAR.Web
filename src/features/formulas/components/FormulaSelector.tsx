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
import { useFormulaCatalog } from '../hooks/useFormulas';
import { catalogLabel, type Catalogo } from '../types/formula';
export function FormulaSelector({
  kind,
  existing,
  onAdd,
  onClose,
  options,
}: {
  kind: 'meses' | 'tipoliquidacion';
  existing: (number | null)[];
  onAdd: (rows: Catalogo[]) => void;
  onClose: () => void;
  options?: Catalogo[];
}) {
  const remote = useFormulaCatalog(kind, !options);
  const query = options
    ? { ...remote, data: options, isFetching: false, isError: false }
    : remote;
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<DataGridSelectionModel>({
    type: 'include',
    ids: [],
  });
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const selected = (query.data ?? []).filter(
    (x) =>
      selection.type === 'include' &&
      selection.ids.includes(x.id) &&
      !existing.includes(x.id),
  );
  const rows = (query.data ?? []).filter(
    (x) =>
      !existing.includes(x.id) &&
      matchesSelection(`${x.id} ${catalogLabel(x)}`, search),
  );
  const label = kind === 'meses' ? 'períodos' : 'tipos de liquidación';
  const columns: DataGridColumn<Catalogo>[] = [
    {
      field: 'id',
      header: kind === 'meses' ? 'Mes' : 'ID',
      getValue: (x) => x.id,
      width: 90,
    },
    { field: 'nombre', header: 'Descripción', getValue: catalogLabel },
  ];
  return (
    <Modal
      open
      title={`Agregar ${label}`}
      size="large"
      onClose={onClose}
      acceptButton={{
        label: `Agregar seleccionados (${selected.length})`,
        disabled: !selected.length || query.isFetching || query.isError,
      }}
      onAccept={() => {
        onAdd(selected);
        onClose();
      }}
    >
      <p>
        Se incorporan al borrador con Aplicar marcado y se guardan junto con la
        fórmula.
      </p>
      <SelectionSearch
        label={`Buscar ${label}`}
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPagination((p) => ({ ...p, page: 0 }));
        }}
      />
      <DataGrid
        label={`Seleccionar ${label}`}
        rows={rows}
        columns={columns}
        getRowId={(x) => x.id}
        processingMode="client"
        selectionMode="multiple"
        checkboxSelection
        selectAll="page"
        selectionModel={selection}
        onSelectionModelChange={setSelection}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        pageSizeOptions={[10, 25, 50, 100]}
        showSearch={false}
        showFilterButton={false}
        loading={query.isFetching}
        error={query.isError ? errorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyMessage="No hay opciones disponibles para agregar."
      />
    </Modal>
  );
}
