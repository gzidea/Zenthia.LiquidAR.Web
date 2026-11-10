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
import { useCatalogo } from '../hooks/useLegajos';
import {
  label as catalogLabel,
  type Opcion as Catalogo,
} from '../types/legajo';
export function ConceptoSelector({
  convenio,
  onAdd,
  onClose,
}: {
  convenio: number;
  onAdd: (rows: Catalogo[]) => void;
  onClose: () => void;
}) {
  const query = useCatalogo('formulas', convenio);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<DataGridSelectionModel>({
    type: 'include',
    ids: [],
  });
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const selected = (query.data ?? []).filter(
    (x) => selection.type === 'include' && selection.ids.includes(x.id),
  );
  const rows = (query.data ?? []).filter((x) =>
    matchesSelection(`${x.id} ${catalogLabel(x)}`, search),
  );
  const label = 'conceptos';
  const columns: DataGridColumn<Catalogo>[] = [
    {
      field: 'id',
      header: 'ID',
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
      <p>Se incorporan al borrador y se guardan junto con el legajo.</p>
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
