import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataGrid } from './DataGrid';
import { Icon } from '@/components/ui/Icon';
import type {
  DataGridColumn,
  DataGridProps,
  DataGridSelectionModel,
} from './types';

interface Row {
  id: number;
  name: string;
  amount: number;
  active: boolean;
  date: Date;
}
const rows: Row[] = [
  {
    id: 1,
    name: 'Beta',
    amount: 20,
    active: true,
    date: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 2,
    name: 'Alfa',
    amount: 10,
    active: false,
    date: new Date('2026-02-01T00:00:00Z'),
  },
  {
    id: 3,
    name: 'Gamma',
    amount: 30,
    active: true,
    date: new Date('2026-03-01T00:00:00Z'),
  },
  {
    id: 4,
    name: 'Delta',
    amount: 40,
    active: false,
    date: new Date('2026-04-01T00:00:00Z'),
  },
];
const columns: DataGridColumn<Row>[] = [
  { field: 'name', header: 'Nombre', getValue: (r) => r.name, hideable: false },
  {
    field: 'amount',
    header: 'Importe',
    getValue: (r) => r.amount,
    type: 'number',
  },
  {
    field: 'active',
    header: 'Activo',
    getValue: (r) => r.active,
    type: 'boolean',
  },
  {
    field: 'date',
    header: 'Fecha',
    getValue: (r) => r.date,
    type: 'date',
    initiallyHidden: true,
  },
];
const base = { label: 'Ejemplo', rows, columns, getRowId: (r: Row) => r.id };
function mount(props: Partial<DataGridProps<Row>> = {}) {
  return render(<DataGrid {...base} {...(props as DataGridProps<Row>)} />);
}

it('excluye filas no seleccionables al seleccionar toda la página y al hacer clic', () => {
  const onChange = vi.fn();
  mount({
    checkboxSelection: true,
    selectionMode: 'multiple',
    isRowSelectable: (r) => r.active,
    onSelectionModelChange: onChange,
  });
  const boxes = screen.getAllByRole('checkbox');
  expect(boxes[2]).toBeDisabled();
  fireEvent.click(boxes[0]!);
  expect(onChange).toHaveBeenLastCalledWith({ type: 'include', ids: [1, 3] });
  onChange.mockClear();
  fireEvent.click(screen.getByText('Alfa'));
  expect(onChange).not.toHaveBeenCalled();
});

it('usa skeleton en carga inicial y conserva los datos durante una recarga', () => {
  const { container, rerender } = mount({
    rows: [],
    loading: true,
    selectionMode: 'multiple',
    rowActions: [{ id: 'view', label: 'Ver', onClick: vi.fn() }],
  });
  expect(screen.getByRole('region', { name: 'Ejemplo' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.getByText('Cargando registros…')).toBeInTheDocument();
  expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
  expect(container.querySelectorAll('tbody tr')[0]?.children).toHaveLength(5);
  expect(
    container.querySelector('tbody input,tbody button,tbody [tabindex]'),
  ).toBeNull();
  expect(
    screen.queryByText('No hay registros para mostrar.'),
  ).not.toBeInTheDocument();
  rerender(<DataGrid {...base} loading />);
  expect(screen.getByText('Beta')).toBeInTheDocument();
  expect(container.querySelector('.skeleton-grid-row')).toBeNull();
  rerender(<DataGrid {...base} rows={[]} />);
  expect(
    screen.getByText('No hay registros para mostrar.'),
  ).toBeInTheDocument();
  rerender(<DataGrid {...base} rows={[]} error="Error de prueba" />);
  expect(screen.getByText('Error de prueba')).toBeInTheDocument();
  expect(container.querySelector('.skeleton-grid-row')).toBeNull();
});

it('el skeleton respeta columnas visibles, altura y tamaño de página', () => {
  const { container } = mount({
    rows: [],
    loading: true,
    rowHeight: 60,
    columnVisibilityModel: { amount: false },
    paginationModel: { page: 0, pageSize: 2 },
  });
  expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(container.querySelectorAll('tbody td')).toHaveLength(4);
  expect(container.querySelector('tbody tr')).toHaveStyle({ height: '60px' });
});
const row = (name: string) =>
  screen.getByRole('row', { name: new RegExp(name) });
const selected = () =>
  screen
    .getAllByRole('row')
    .filter((r) => r.getAttribute('aria-selected') === 'true');

describe('DataGrid', () => {
  it('muestra búsqueda sin título visible y controles de filtros/columnas solo con iconos', () => {
    mount();
    expect(
      screen.getByRole('searchbox', { name: 'Buscar en Ejemplo' }),
    ).toHaveAttribute('placeholder', 'Buscar…');
    expect(screen.queryByText('Buscar en Ejemplo')).not.toBeInTheDocument();
    for (const name of ['Filtros', 'Columnas']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('title', name);
      expect(button.textContent).toBe('');
      expect(button.querySelector('svg')).not.toBeNull();
    }
    expect(
      screen.getByRole('combobox', { name: 'Filas por página' }),
    ).toBeVisible();
    expect(screen.queryByText('Filas por página')).not.toBeInTheDocument();
  });
  it.each(['icon', 'icon-text', 'text'] as const)(
    'acciones globales y por fila en modo %s conservan nombre y callback',
    async (display) => {
      const onClick = vi.fn();
      mount({
        rows: rows.slice(0, 1),
        globalActions: [
          {
            id: 'new',
            label: 'Nuevo',
            icon: <Icon name="plus" />,
            display,
            onClick,
          },
        ],
        rowActions: [
          {
            id: 'edit',
            label: 'Editar',
            icon: <Icon name="edit" />,
            display,
            onClick,
          },
        ],
      });
      for (const label of ['Nuevo', 'Editar']) {
        const button = screen.getByRole('button', { name: label });
        expect(button.textContent).toBe(display === 'icon' ? '' : label);
        expect(Boolean(button.querySelector('svg'))).toBe(display !== 'text');
        await userEvent.click(button);
      }
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(onClick).toHaveBeenLastCalledWith(rows[0]);
    },
  );
  it('configura alto de filas y cambia ancho con teclado respetando límites', async () => {
    const changed = vi.fn();
    mount({
      rowHeight: 64,
      columns: [
        { ...columns[0]!, width: 180, minWidth: 150, maxWidth: 200 },
        { ...columns[1]!, resizable: false },
      ],
      onColumnWidthsModelChange: changed,
    });
    expect(
      screen
        .getByRole('region', { name: 'Ejemplo' })
        .style.getPropertyValue('--data-grid-row-height'),
    ).toBe('64px');
    const handle = screen.getByRole('separator', { name: 'Ancho de Nombre' });
    expect(
      screen.queryByRole('separator', { name: 'Ancho de Importe' }),
    ).not.toBeInTheDocument();
    handle.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '190');
    await userEvent.keyboard('{End}{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '200');
    await userEvent.keyboard('{Home}{ArrowLeft}');
    expect(handle).toHaveAttribute('aria-valuenow', '150');
    expect(changed).toHaveBeenLastCalledWith({ name: 150 });
  });
  it('el ancho controlado emite cambios y espera nuevas props', async () => {
    const changed = vi.fn();
    const { rerender } = mount({
      columnWidthsModel: { name: 200 },
      onColumnWidthsModelChange: changed,
    });
    const handle = screen.getByRole('separator', { name: 'Ancho de Nombre' });
    handle.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(changed).toHaveBeenLastCalledWith({ name: 190 });
    expect(handle).toHaveAttribute('aria-valuenow', '200');
    rerender(
      <DataGrid
        {...base}
        columnWidthsModel={{ name: 190 }}
        onColumnWidthsModelChange={changed}
      />,
    );
    expect(handle).toHaveAttribute('aria-valuenow', '190');
  });
  it('renderiza columnas, valores y formatos sin mutar los datos', () => {
    mount({
      columns: [
        ...columns,
        {
          field: 'custom',
          header: 'Personalizado',
          getValue: (r) => r.name,
          render: (r) => <strong>{r.name}!</strong>,
        },
        {
          field: 'format',
          header: 'Formato',
          getValue: (r) => r.amount,
          format: (v) => `$${v}`,
        },
      ],
    });
    expect(screen.getByRole('table', { name: 'Ejemplo' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: /Nombre/ })).toBeVisible();
    expect(
      screen.queryByRole('columnheader', { name: /Fecha/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Beta!')).toBeVisible();
    expect(screen.getByText('$20')).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(rows[0]?.id).toBe(1);
  });
  it('muestra carga, vacío configurable y error con reintento', async () => {
    const retry = vi.fn();
    const { rerender } = mount({ rows: [], loading: true });
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(screen.getByRole('region', { name: 'Ejemplo' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    rerender(<DataGrid {...base} rows={[]} emptyMessage="Sin elementos" />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin elementos');
    rerender(<DataGrid {...base} error="No se pudo cargar" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it('busca localmente, notifica y distingue sin resultados', async () => {
    const changed = vi.fn();
    mount({ onSearchChange: changed });
    await userEvent.type(screen.getByLabelText('Buscar en Ejemplo'), 'ALFA');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(row('Alfa')).toBeVisible();
    expect(changed).toHaveBeenLastCalledWith('ALFA');
    await userEvent.type(screen.getByLabelText('Buscar en Ejemplo'), 'x');
    expect(screen.getByRole('status')).toHaveTextContent('No hay resultados');
  });
  it('ordena ascendente, descendente y sin orden', async () => {
    const changed = vi.fn();
    mount({ onSortModelChange: changed });
    const sort = screen.getByRole('button', { name: 'Ordenar por Importe' });
    await userEvent.click(sort);
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Alfa');
    expect(sort.closest('th')).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(sort);
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Delta');
    await userEvent.click(sort);
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Beta');
    expect(changed).toHaveBeenLastCalledWith(null);
  });
  it('combina filtros numéricos, booleanos, fechas y texto; permite limpiarlos', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.selectOptions(
      screen.getByLabelText('Operador de Importe'),
      'gt',
    );
    await user.type(screen.getByLabelText('Filtrar Importe'), '15');
    await user.selectOptions(screen.getByLabelText('Filtrar Activo'), 'true');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText('Operador de Fecha'), 'gt');
    fireEvent.change(screen.getByLabelText('Filtrar Fecha'), {
      target: { value: '2026-02-01' },
    });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(row('Gamma')).toBeVisible();
    await user.type(screen.getByLabelText('Filtrar Nombre'), 'Z');
    expect(screen.getByRole('status')).toHaveTextContent('No hay resultados');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getAllByRole('row')).toHaveLength(5);
  });
  it('soporta opciones y operadores/render de filtro personalizados', async () => {
    mount({
      columns: [
        {
          field: 'name',
          header: 'Nombre',
          getValue: (r) => r.name,
          type: 'select',
          options: [{ value: 'Alfa', label: 'Alfa' }],
        },
        {
          field: 'amount',
          header: 'Importe',
          getValue: (r) => r.amount,
          filterOperators: [
            {
              value: 'minimum',
              label: 'Mínimo',
              test: (v, f) => Number(v) >= Number(f),
            },
          ],
          renderFilter: (filter, onChange) => (
            <input
              aria-label="Mínimo personalizado"
              value={filter.value}
              onChange={(e) => onChange(e.target.value)}
            />
          ),
        },
      ],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    await userEvent.selectOptions(
      screen.getByLabelText('Filtrar Nombre'),
      'Alfa',
    );
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await userEvent.type(screen.getByLabelText('Mínimo personalizado'), '20');
    expect(screen.getByRole('status')).toHaveTextContent('No hay resultados');
  });
  it('pagina localmente y reinicia página al cambiar búsqueda o tamaño', async () => {
    mount({
      initialState: { pagination: { page: 0, pageSize: 2 } },
      pageSizeOptions: [1, 2],
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Página siguiente' }),
    );
    expect(row('Gamma')).toBeVisible();
    expect(screen.getByText('3–4 de 4')).toBeVisible();
    await userEvent.type(screen.getByLabelText('Buscar en Ejemplo'), 'Alfa');
    expect(row('Alfa')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Página anterior' }),
    ).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Buscar en Ejemplo'));
    await userEvent.selectOptions(
      screen.getByLabelText('Filas por página'),
      '1',
    );
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await userEvent.click(
      screen.getByRole('button', { name: 'Última página' }),
    );
    expect(row('Delta')).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Página anterior' }),
    );
    expect(row('Gamma')).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Primera página' }),
    );
    expect(row('Beta')).toBeVisible();
  });
  it('no procesa datos remotos y emite el estado de consulta', async () => {
    const page = vi.fn(),
      search = vi.fn(),
      sort = vi.fn(),
      filter = vi.fn();
    mount({
      processingMode: 'server',
      rowCount: 50,
      paginationModel: { page: 0, pageSize: 4 },
      onPaginationModelChange: page,
      onSearchChange: search,
      onSortModelChange: sort,
      onFilterModelChange: filter,
    });
    await userEvent.type(
      screen.getByLabelText('Buscar en Ejemplo'),
      'inexistente',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Ordenar por Importe' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    await userEvent.type(screen.getByLabelText('Filtrar Importe'), '99');
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Beta');
    expect(search).toHaveBeenLastCalledWith('inexistente');
    expect(sort).toHaveBeenCalledWith({ field: 'amount', direction: 'asc' });
    expect(filter).toHaveBeenLastCalledWith([
      { field: 'amount', operator: 'eq', value: '99' },
    ]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Página siguiente' }),
    );
    expect(page).toHaveBeenLastCalledWith({ page: 1, pageSize: 4 });
  });
  it('selecciona con click, Ctrl/Cmd y Shift siguiendo el orden visible', () => {
    const changed = vi.fn();
    mount({ selectionMode: 'multiple', onSelectionModelChange: changed });
    fireEvent.click(row('Beta'));
    fireEvent.click(row('Gamma'), { ctrlKey: true });
    expect(selected()).toHaveLength(2);
    fireEvent.click(row('Beta'), { metaKey: true });
    expect(selected()).toHaveLength(1);
    fireEvent.click(row('Delta'), { shiftKey: true });
    expect(selected()).toHaveLength(4);
    expect(changed).toHaveBeenLastCalledWith({
      type: 'include',
      ids: [3, 1, 2, 4],
    });
    fireEvent.click(row('Alfa'));
    expect(selected()).toHaveLength(1);
  });
  it('single y none respetan los modos de selección', () => {
    const { rerender } = mount({ selectionMode: 'single' });
    fireEvent.click(row('Beta'));
    fireEvent.click(row('Alfa'), { ctrlKey: true });
    expect(selected()).toHaveLength(1);
    fireEvent.click(row('Alfa'));
    expect(selected()).toHaveLength(0);
    rerender(<DataGrid {...base} selectionMode="none" />);
    fireEvent.click(row('Beta'));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(selected()).toHaveLength(0);
  });
  it('permite selección por teclado y rangos con flechas', () => {
    mount({ selectionMode: 'multiple', checkboxSelection: false });
    const beta = row('Beta');
    beta.focus();
    fireEvent.keyDown(beta, { key: ' ' });
    fireEvent.keyDown(beta, { key: 'ArrowDown', shiftKey: true });
    expect(row('Alfa')).toHaveFocus();
    expect(selected()).toHaveLength(2);
    fireEvent.keyDown(row('Alfa'), { key: 'End' });
    expect(row('Delta')).toHaveFocus();
    fireEvent.keyDown(row('Delta'), { key: 'Home' });
    expect(beta).toHaveFocus();
  });
  it('permite deshabilitar selección mediante fila y teclado', () => {
    mount({
      selectionMode: 'multiple',
      selectOnClick: false,
      selectOnKeyboard: false,
    });
    fireEvent.click(row('Beta'));
    fireEvent.keyDown(row('Beta'), { key: ' ' });
    expect(selected()).toHaveLength(0);
    fireEvent.click(screen.getByLabelText('Seleccionar fila 1'));
    expect(selected()).toHaveLength(1);
  });
  it('selecciona página, conserva selección al paginar y selecciona dataset local', async () => {
    mount({
      selectionMode: 'multiple',
      selectAll: 'dataset',
      initialState: { pagination: { page: 0, pageSize: 2 } },
    });
    await userEvent.click(screen.getByLabelText('Seleccionar página actual'));
    expect(screen.getByText('2 seleccionados')).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Página siguiente' }),
    );
    expect(selected()).toHaveLength(0);
    await userEvent.click(
      screen.getByRole('button', { name: 'Seleccionar todos los resultados' }),
    );
    expect(screen.getByText('4 seleccionados')).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Limpiar selección' }),
    );
    expect(screen.getByText('0 seleccionados')).toBeVisible();
  });
  it('representa todos los resultados remotos sin inventar filas; invalida otro scope', async () => {
    const action = vi.fn();
    function Harness() {
      const [selection, setSelection] = useState<DataGridSelectionModel>({
        type: 'include',
        ids: [],
      });
      const [scope, setScope] = useState('query-A');
      return (
        <>
          <button onClick={() => setScope('query-B')}>Otra consulta</button>
          <DataGrid
            {...base}
            processingMode="server"
            rowCount={100}
            paginationModel={{ page: 0, pageSize: 4 }}
            onPaginationModelChange={() => {}}
            selectionMode="multiple"
            selectAll="dataset"
            selectionScope={scope}
            selectionModel={selection}
            onSelectionModelChange={setSelection}
            bulkActions={[{ id: 'apply', label: 'Aplicar', onClick: action }]}
          />
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Seleccionar todos los resultados' }),
    );
    await userEvent.click(screen.getByLabelText('Seleccionar fila 1'));
    expect(screen.getByText('99 seleccionados')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(action).toHaveBeenLastCalledWith({
      model: { type: 'all', excludedIds: [1], scope: 'query-A' },
      loadedRows: rows.slice(1),
      count: 99,
    });
    await userEvent.click(screen.getByLabelText('Seleccionar fila 1'));
    expect(screen.getByText('100 seleccionados')).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Otra consulta' }),
    );
    expect(screen.getByText('0 seleccionados')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });
  it('conserva IDs seleccionados ausentes de la página remota', () => {
    const changed = vi.fn();
    const props = {
      ...base,
      processingMode: 'server' as const,
      rowCount: 4,
      paginationModel: { page: 0, pageSize: 2 },
      onPaginationModelChange: vi.fn(),
      selectionMode: 'multiple' as const,
      onSelectionModelChange: changed,
    };
    const { rerender } = render(
      <DataGrid {...props} rows={rows.slice(0, 2)} />,
    );
    fireEvent.click(row('Beta'));
    rerender(
      <DataGrid
        {...props}
        rows={rows.slice(2)}
        paginationModel={{ page: 1, pageSize: 2 }}
      />,
    );
    expect(screen.getByText('1 seleccionados')).toBeVisible();
    fireEvent.click(row('Gamma'), { ctrlKey: true });
    expect(changed).toHaveBeenLastCalledWith({ type: 'include', ids: [1, 3] });
  });
  it('acciones globales, por fila y masivas respetan visible/disabled y no seleccionan filas', async () => {
    const edit = vi.fn(),
      bulk = vi.fn(),
      global = vi.fn();
    mount({
      selectionMode: 'multiple',
      rowActions: [
        {
          id: 'edit',
          label: 'Editar',
          onClick: edit,
          visible: (r) => r.active,
          disabled: (r) => r.id === 3,
        },
      ],
      globalActions: [
        { id: 'create', label: 'Crear', onClick: global },
        { id: 'hidden', label: 'Oculta', visible: false, onClick: global },
      ],
      bulkActions: [
        {
          id: 'bulk',
          label: 'Aplicar',
          onClick: bulk,
          disabled: (c) => c.count > 2,
        },
      ],
    });
    expect(screen.queryByText('Oculta')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(global).toHaveBeenCalledOnce();
    await userEvent.click(
      within(row('Beta')).getByRole('button', { name: 'Editar' }),
    );
    expect(edit).toHaveBeenCalledWith(rows[0]);
    expect(selected()).toHaveLength(0);
    expect(
      within(row('Gamma')).getByRole('button', { name: 'Editar' }),
    ).toBeDisabled();
    expect(within(row('Alfa')).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
    fireEvent.click(row('Beta'));
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(bulk).toHaveBeenCalledWith({
      model: { type: 'include', ids: [1] },
      loadedRows: [rows[0]],
      count: 1,
    });
    await userEvent.click(screen.getByLabelText('Seleccionar página actual'));
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });
  it('oculta, muestra y reordena columnas con controles accesibles', async () => {
    const changed = vi.fn();
    mount({ onColumnOrderChange: changed });
    await userEvent.click(screen.getByRole('button', { name: 'Columnas' }));
    expect(screen.getByLabelText('Nombre', { exact: true })).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Importe', { exact: true }));
    expect(
      screen.queryByRole('columnheader', { name: /Importe/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Importe', { exact: true }));
    await userEvent.click(screen.getByLabelText('Fecha', { exact: true }));
    expect(screen.getByRole('columnheader', { name: /Fecha/ })).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Mover Importe a la izquierda' }),
    );
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Importe');
    expect(changed).toHaveBeenLastCalledWith([
      'amount',
      'name',
      'active',
      'date',
    ]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Mover Importe a la derecha' }),
    );
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Nombre');
  });
  it('reordena por arrastre nativo', () => {
    mount();
    const source = screen.getByRole('button', {
      name: 'Ordenar por Importe',
    }).parentElement!;
    fireEvent.dragStart(source, { dataTransfer: { setData: vi.fn() } });
    fireEvent.dragOver(screen.getByRole('columnheader', { name: /Nombre/ }));
    fireEvent.drop(screen.getByRole('columnheader', { name: /Nombre/ }));
    fireEvent.dragEnd(source);
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Importe');
  });
  it('los modelos controlados notifican sin cambiar hasta recibir nuevas props', async () => {
    const visibility = vi.fn(),
      selection = vi.fn(),
      sort = vi.fn(),
      order = vi.fn(),
      search = vi.fn();
    mount({
      search: '',
      onSearchChange: search,
      sortModel: null,
      onSortModelChange: sort,
      selectionMode: 'multiple',
      selectionModel: { type: 'include', ids: [] },
      onSelectionModelChange: selection,
      columnVisibilityModel: {},
      onColumnVisibilityModelChange: visibility,
      columnOrder: ['name', 'amount'],
      onColumnOrderChange: order,
    });
    fireEvent.click(row('Beta'));
    expect(selected()).toHaveLength(0);
    expect(selection).toHaveBeenCalledWith({ type: 'include', ids: [1] });
    await userEvent.type(screen.getByLabelText('Buscar en Ejemplo'), 'A');
    expect(screen.getByLabelText('Buscar en Ejemplo')).toHaveValue('');
    await userEvent.click(
      screen.getByRole('button', { name: 'Ordenar por Importe' }),
    );
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Beta');
    await userEvent.click(screen.getByRole('button', { name: 'Columnas' }));
    await userEvent.click(screen.getByLabelText('Importe', { exact: true }));
    expect(visibility).toHaveBeenCalledWith({ amount: false });
    expect(screen.getByRole('columnheader', { name: /Importe/ })).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Mover Importe a la izquierda' }),
    );
    expect(order).toHaveBeenCalledWith(['amount', 'name', 'active', 'date']);
  });
});
