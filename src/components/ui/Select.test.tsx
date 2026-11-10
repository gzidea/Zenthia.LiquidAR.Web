import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { expect, it, vi } from 'vitest';
import { Select } from './Select';

it('conserva la etiqueta cuando el control está dentro de un label y Tab continúa el formulario', async () => {
  const user = userEvent.setup();
  render(
    <>
      <label>
        Actividad<Select>{options()}</Select>
      </label>
      <button>Continuar</button>
    </>,
  );
  await user.click(screen.getByRole('combobox', { name: 'Actividad' }));
  expect(screen.getByRole('combobox', { name: 'Actividad' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await user.keyboard('{Tab}');
  expect(screen.getByRole('button', { name: 'Continuar' })).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('cierra el menú cuando el campo queda bloqueado', async () => {
  function Form() {
    const [disabled, setDisabled] = useState(false);
    return (
      <>
        <fieldset disabled={disabled}>
          <Select aria-label="Actividad">{options()}</Select>
        </fieldset>
        <button onClick={() => setDisabled(true)}>Bloquear</button>
      </>
    );
  }
  const user = userEvent.setup();
  render(<Form />);
  await user.click(screen.getByLabelText('Actividad'));
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Bloquear' }));
  expect(screen.getByLabelText('Actividad')).toBeDisabled();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

function options() {
  return (
    <>
      <option value="">Sin selección</option>
      <option value="1" data-search="101">
        Construcción
      </option>
      <option value="2">Comercio</option>
      <option value="3" disabled>
        Inactiva
      </option>
    </>
  );
}
it('busca sin tildes, conserva la selección al filtrar y permite limpiar', async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  render(
    <Select aria-label="Actividad" defaultValue="2" onChange={change}>
      {options()}
    </Select>,
  );
  const select = screen.getByLabelText('Actividad');
  await user.click(select);
  await user.type(
    screen.getByRole('combobox', { name: 'Buscar opciones' }),
    'CONSTRUCCION',
  );
  const list = screen.getByRole('listbox');
  expect(within(list).getAllByRole('option')).toHaveLength(1);
  expect(select).toHaveValue('2');
  expect(change).not.toHaveBeenCalled();
  await user.click(within(list).getByRole('option', { name: 'Construcción' }));
  expect(select).toHaveValue('1');
  expect(change).toHaveBeenCalledOnce();
  expect(select).toHaveFocus();
  await user.click(select);
  await user.type(screen.getByLabelText('Buscar opciones'), 'sin resultados');
  expect(screen.getByRole('status')).toHaveTextContent('Sin coincidencias');
  await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
  expect(
    within(screen.getByRole('listbox')).getAllByRole('option'),
  ).toHaveLength(4);
});
it('busca por código y presenta columnas con sus valores reales', async () => {
  const user = userEvent.setup();
  render(
    <Select
      aria-label="Concepto"
      columns={['Descripción', 'Columna del recibo']}
    >
      <option value="7" data-search="102" data-secondary="No remunerativo">
        Adicional
      </option>
    </Select>,
  );
  await user.click(screen.getByLabelText('Concepto'));
  expect(screen.getByText('Columna del recibo')).toBeVisible();
  await user.type(screen.getByLabelText('Buscar opciones'), 'remunerativo');
  expect(
    within(screen.getByRole('listbox')).getByRole('option'),
  ).toHaveTextContent('AdicionalNo remunerativo');
  await user.clear(screen.getByLabelText('Buscar opciones'));
  await user.type(screen.getByLabelText('Buscar opciones'), '102');
  expect(
    within(screen.getByRole('listbox')).getAllByRole('option'),
  ).toHaveLength(1);
});
it('permite seleccionar con teclado y Escape conserva el valor sin cerrar el contenedor', async () => {
  const user = userEvent.setup();
  const parentKey = vi.fn();
  render(
    <div onKeyDown={parentKey}>
      <Select aria-label="Actividad">{options()}</Select>
    </div>,
  );
  const select = screen.getByLabelText('Actividad');
  select.focus();
  await user.keyboard('{ArrowDown}');
  await user.type(screen.getByLabelText('Buscar opciones'), 'comercio');
  await user.keyboard('{Enter}');
  expect(select).toHaveValue('2');
  await user.keyboard('{ArrowDown}');
  parentKey.mockClear();
  await user.keyboard('{Escape}');
  expect(select).toHaveValue('2');
  expect(select).toHaveFocus();
  expect(parentKey).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('oculta la búsqueda por configuración y respeta campos deshabilitados', async () => {
  const user = userEvent.setup();
  render(
    <>
      <Select aria-label="Tipo" searchable={false}>
        {options()}
      </Select>
      <fieldset disabled>
        <Select aria-label="Bloqueado">{options()}</Select>
      </fieldset>
    </>,
  );
  await user.click(screen.getByLabelText('Tipo'));
  expect(screen.queryByLabelText('Buscar opciones')).not.toBeInTheDocument();
  await user.keyboard('{ArrowDown}{Enter}');
  expect(screen.getByLabelText('Tipo')).toHaveValue('1');
  await user.click(screen.getByLabelText('Bloqueado'));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('integra registro, guardado y reset de React Hook Form', async () => {
  const save = vi.fn();
  function Form() {
    const { register, handleSubmit, reset } = useForm({
      defaultValues: { actividad: '2' },
    });
    return (
      <form onSubmit={handleSubmit(save)}>
        <Select aria-label="Actividad" {...register('actividad')}>
          {options()}
        </Select>
        <button type="submit">Guardar</button>
        <button type="button" onClick={() => reset({ actividad: '2' })}>
          Deshacer
        </button>
      </form>
    );
  }
  const user = userEvent.setup();
  render(<Form />);
  await user.click(screen.getByLabelText('Actividad'));
  await user.click(
    within(screen.getByRole('listbox')).getByRole('option', {
      name: 'Construcción',
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(save).toHaveBeenCalledWith({ actividad: '1' }, expect.anything());
  await user.click(screen.getByRole('button', { name: 'Deshacer' }));
  expect(screen.getByLabelText('Actividad')).toHaveValue('2');
  await user.click(screen.getByLabelText('Actividad'));
  expect(
    within(screen.getByRole('listbox')).getByRole('option', {
      name: 'Comercio',
    }),
  ).toHaveAttribute('aria-selected', 'true');
});
it('respeta cambios controlados y catálogos dependientes', async () => {
  function Form() {
    const [value, setValue] = useState('1');
    const [parent, setParent] = useState(false);
    return (
      <>
        <Select
          aria-label="Actividad"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="">Sin selección</option>
          {parent ? <option value="4">Transporte</option> : options()}
        </Select>
        <button
          onClick={() => {
            setParent(true);
            setValue('');
          }}
        >
          Cambiar empresa
        </button>
      </>
    );
  }
  const user = userEvent.setup();
  render(<Form />);
  await user.click(screen.getByRole('button', { name: 'Cambiar empresa' }));
  expect(screen.getByLabelText('Actividad')).toHaveValue('');
  await user.click(screen.getByLabelText('Actividad'));
  const list = screen.getByRole('listbox');
  expect(
    within(list).queryByRole('option', { name: 'Comercio' }),
  ).not.toBeInTheDocument();
  await user.click(within(list).getByRole('option', { name: 'Transporte' }));
  expect(screen.getByLabelText('Actividad')).toHaveValue('4');
});
