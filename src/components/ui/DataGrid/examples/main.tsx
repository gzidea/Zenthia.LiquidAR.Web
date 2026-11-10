import { Select } from '@/components/ui/Select';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/fraunces/600.css';
import '@/styles/theme.css';
import {
  DataGrid,
  type DataGridColumn,
  type DataGridFilterModel,
  type DataGridPaginationModel,
  type DataGridSelectionModel,
  type DataGridSortModel,
} from '..';
import { processRows } from '../model';
import { Icon } from '@/components/ui/Icon';

interface ExampleRow {
  id: number;
  name: string;
  amount: number;
  active: boolean;
  date: string;
}
const rows: ExampleRow[] = Array.from({ length: 60 }, (_, index) => ({
  id: index + 1,
  name: `Registro ${String(index + 1).padStart(2, '0')}`,
  amount: (index + 1) * 100,
  active: index % 2 === 0,
  date: '2026-09-01',
}));
const columns: DataGridColumn<ExampleRow>[] = [
  {
    field: 'name',
    header: 'Nombre',
    getValue: (row) => row.name,
    hideable: false,
    minWidth: 180,
  },
  {
    field: 'amount',
    header: 'Importe',
    getValue: (row) => row.amount,
    type: 'number',
    align: 'right',
    format: (value) =>
      Number(value).toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
      }),
  },
  {
    field: 'active',
    header: 'Activo',
    getValue: (row) => row.active,
    type: 'boolean',
  },
  {
    field: 'date',
    header: 'Fecha',
    getValue: (row) => row.date,
    type: 'date',
    initiallyHidden: true,
  },
];
const getRowId = (row: ExampleRow) => row.id;
function Demo() {
  const [message, setMessage] = useState(
    'Elegí una acción para ver su resultado.',
  );
  const [state, setState] = useState('data');
  const [actionDisplay, setActionDisplay] = useState<
    'text' | 'icon' | 'icon-text'
  >('icon-text');
  const [rowHeight, setRowHeight] = useState(48);
  const [pagination, setPagination] = useState<DataGridPaginationModel>({
    page: 0,
    pageSize: 10,
  });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DataGridSortModel>(null);
  const [filters, setFilters] = useState<DataGridFilterModel>([]);
  const [selection, setSelection] = useState<DataGridSelectionModel>({
    type: 'include',
    ids: [],
  });
  // Simulates the consumer's server response without any HTTP or React Query dependency.
  const result = processRows(rows, columns, search, filters, sort);
  return (
    <main style={{ padding: 'var(--space-4)', maxWidth: 1400, margin: 'auto' }}>
      <h1>Grilla reutilizable</h1>
      <p>
        Datos ficticios. Selección por clic, Ctrl/Cmd y Shift; flechas y espacio
        para teclado.
      </p>
      <p role="status">{message}</p>
      <h2 style={{ marginBlock: 'var(--space-4)' }}>Datos locales</h2>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-3)',
        }}
      >
        <label>
          Presentación de acciones{' '}
          <Select
            value={actionDisplay}
            onChange={(event) =>
              setActionDisplay(event.target.value as typeof actionDisplay)
            }
          >
            <option value="icon-text">Icono y texto</option>
            <option value="icon">Solo icono</option>
            <option value="text">Solo texto</option>
          </Select>
        </label>
        <label>
          Alto de filas{' '}
          <Select
            value={rowHeight}
            onChange={(event) => setRowHeight(Number(event.target.value))}
          >
            <option value={36}>36 px</option>
            <option value={48}>48 px</option>
            <option value={64}>64 px</option>
          </Select>
        </label>
      </div>
      <DataGrid
        label="Registros locales"
        rows={rows}
        columns={columns}
        getRowId={getRowId}
        selectionMode="multiple"
        selectAll="dataset"
        rowHeight={rowHeight}
        initialState={{ pagination: { page: 0, pageSize: 10 } }}
        globalActions={[
          {
            id: 'new',
            label: 'Nuevo',
            icon: <Icon name="plus" />,
            display: actionDisplay,
            onClick: () => setMessage('Acción global ejecutada.'),
          },
        ]}
        rowActions={[
          {
            id: 'view',
            label: 'Ver',
            icon: <Icon name="eye" />,
            display: actionDisplay,
            onClick: (row) => setMessage(`Ver ${row.name}`),
          },
          {
            id: 'edit',
            label: 'Editar',
            icon: <Icon name="edit" />,
            display: actionDisplay,
            disabled: (row) => !row.active,
            onClick: (row) => setMessage(`Editar ${row.name}`),
          },
        ]}
        bulkActions={[
          {
            id: 'apply',
            label: 'Aplicar a selección',
            onClick: (context) =>
              setMessage(`Acción sobre ${context.count} registros.`),
          },
        ]}
      />
      <h2 style={{ marginBlock: 'var(--space-4)' }}>
        Consulta remota simulada
      </h2>
      <p>
        La demo entrega solo la página solicitada. Todos los modelos se
        controlan desde el consumidor.
      </p>
      <DataGrid
        label="Registros remotos"
        processingMode="server"
        rows={result.slice(
          pagination.page * pagination.pageSize,
          (pagination.page + 1) * pagination.pageSize,
        )}
        columns={columns}
        getRowId={getRowId}
        rowCount={result.length}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        search={search}
        onSearchChange={setSearch}
        sortModel={sort}
        onSortModelChange={setSort}
        filterModel={filters}
        onFilterModelChange={setFilters}
        selectionMode="multiple"
        selectAll="dataset"
        selectionScope={JSON.stringify({ search, filters })}
        selectionModel={selection}
        onSelectionModelChange={setSelection}
        bulkActions={[
          {
            id: 'apply',
            label: 'Mostrar selección remota',
            onClick: (context) =>
              setMessage(
                JSON.stringify({
                  model: context.model,
                  count: context.count,
                  loaded: context.loadedRows.length,
                }),
              ),
          },
        ]}
      />
      <h2 style={{ marginBlock: 'var(--space-4)' }}>Estados visuales</h2>
      <label>
        Estado de ejemplo{' '}
        <Select
          value={state}
          onChange={(event) => setState(event.target.value)}
        >
          <option value="data">Datos</option>
          <option value="loading">Cargando</option>
          <option value="empty">Vacío</option>
          <option value="error">Error</option>
        </Select>
      </label>
      <DataGrid
        label="Estados"
        rows={state === 'data' ? rows.slice(0, 3) : []}
        columns={columns}
        getRowId={getRowId}
        loading={state === 'loading'}
        error={
          state === 'error' ? 'No se pudieron cargar los registros.' : null
        }
        onRetry={() => setState('data')}
      />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
