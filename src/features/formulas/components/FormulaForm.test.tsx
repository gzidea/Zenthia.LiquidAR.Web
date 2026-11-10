import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { FormulaForm } from './FormulaForm';
import { emptyFormula } from '../schemas/formulaSchema';
import type { CatalogKind, Catalogo, FormulaCompleta } from '../types/formula';

const state = vi.hoisted(() => ({
  rows: {} as Partial<Record<CatalogKind, Catalogo[]>>,
  loading: true,
  failed: false,
  allowed: true,
}));
vi.mock('../hooks/useFormulas', () => ({
  useFormulaCatalog: (kind: CatalogKind) => ({
    data: state.rows[kind],
    isFetching: state.loading,
    isError: state.failed,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/features/auth/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => state.allowed }),
}));

const initial: FormulaCompleta = {
  formula: {
    ...emptyFormula,
    id: 15,
    conceptoId: 145,
    unidadId: 7,
    convenioId: 3,
    descripcion: 'Original',
    conceptoDescripcion: 'Concepto guardado',
    unidadDescripcion: 'Unidad guardada',
    convenioNombre: 'Convenio guardado',
    variable: '',
    descripcionCompleta: 'Original',
  },
  periodos: [],
  tiposLiquidacion: [],
};
function loaded() {
  state.loading = false;
  state.rows = {
    conceptos: [
      { id: 145, descripcion: 'Concepto del catálogo', columnaRecibo: 2 },
    ],
    unidades: [{ id: 7, descripcion: 'Unidad del catálogo' }],
    convenios: [{ id: 3, nombre: 'Convenio del catálogo' }],
  };
}
beforeEach(() => {
  state.rows = {};
  state.loading = true;
  state.failed = false;
  state.allowed = true;
});
function mount() {
  const save = vi.fn().mockResolvedValue(undefined);
  const content = (version = 0) => (
    <>
      <FormulaForm
        key={version}
        initial={initial}
        busy={false}
        readOnly={false}
        canDelete
        onSubmit={save}
      />
      <button type="submit" form="formula-form">
        Guardar prueba
      </button>
    </>
  );
  const view = render(content());
  return {
    save,
    refresh: () => view.rerender(content()),
    reopen: () => view.rerender(content(1)),
  };
}
async function assertSaved(
  save: ReturnType<typeof vi.fn>,
  description: string,
) {
  await userEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.lastCall?.[0].formula).toMatchObject({
    conceptoId: 145,
    unidadId: 7,
    convenioId: 3,
    descripcion: description,
  });
}
it('conserva IDs, descripciones y borrador cuando los catálogos llegan después del detalle', async () => {
  const user = userEvent.setup();
  const { save, refresh } = mount();
  expect(screen.getByLabelText('Concepto', { exact: true })).toHaveValue('145');
  expect(screen.getByLabelText('Unidad', { exact: true })).toHaveValue('7');
  await user.clear(screen.getByLabelText('Descripción', { exact: true }));
  await user.type(
    screen.getByLabelText('Descripción', { exact: true }),
    'Modificada',
  );
  loaded();
  refresh();
  for (const [label, value] of [
    ['Concepto', '145'],
    ['Unidad', '7'],
    ['Convenio', '3'],
  ]) {
    const select = screen.getByLabelText(label!, { exact: true });
    expect(select).toHaveValue(value);
    await user.click(select);
    expect(
      within(screen.getByRole('listbox')).getByRole('option', {
        selected: true,
      }),
    ).toHaveTextContent('del catálogo');
    await user.keyboard('{Escape}');
    await user.tab();
    expect(select).toHaveValue(value);
  }
  expect(screen.getByLabelText('Columna del recibo')).toHaveValue(
    'No remunerativo',
  );
  await assertSaved(save, 'Modificada');
});
it('conserva la selección con catálogos en caché y al volver a montar el formulario', async () => {
  loaded();
  const { save, reopen } = mount();
  await userEvent.clear(screen.getByLabelText('Descripción', { exact: true }));
  reopen();
  expect(screen.getByLabelText('Descripción', { exact: true })).toHaveValue(
    'Original',
  );
  expect(screen.getByLabelText('Concepto', { exact: true })).toHaveValue('145');
  expect(screen.getByLabelText('Unidad', { exact: true })).toHaveValue('7');
  await assertSaved(save, 'Original');
});
it.each(['sin permiso', 'error de catálogo', 'referencia ausente'])(
  'preserva las referencias guardadas: %s',
  async (scenario) => {
    const { save, refresh } = mount();
    state.loading = false;
    state.allowed = scenario !== 'sin permiso';
    state.failed = scenario === 'error de catálogo';
    state.rows = { conceptos: [], unidades: [], convenios: [] };
    refresh();
    expect(
      screen.getByLabelText('Concepto', { exact: true }),
    ).toHaveDisplayValue('Concepto guardado');
    expect(screen.getByLabelText('Unidad', { exact: true })).toHaveDisplayValue(
      'Unidad guardada',
    );
    await assertSaved(save, 'Original');
  },
);
