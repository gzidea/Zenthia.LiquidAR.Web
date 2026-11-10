import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ObraSocialForm } from './ObraSocialForm';
import { initialFields, toWrite } from '../schemas/obraSocialSchema';
import { ApiError } from '@/services/http/ApiError';
it('muestra validación por campo y conserva provincia ausente e importe exacto', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const initial = {
    ...toWrite(initialFields()),
    id: 7,
    localidad: 'Rosario',
    provinciaNombre: null,
    idProvincia: 99,
    importeAporte: '999999999999999.9999',
  };
  const view = render(
    <ObraSocialForm
      id="form"
      initial={initial}
      provincias={[{ id: 1, nombre: 'Buenos Aires' }]}
      busy={false}
      error={null}
      onSubmit={onSubmit}
    />,
  );
  expect(screen.getByLabelText('Provincia')).toHaveValue('99');
  fireEvent.change(screen.getByLabelText('Código'), {
    target: { value: 'a'.repeat(256) },
  });
  fireEvent.submit(view.container.querySelector('form')!);
  await screen.findByText('Máximo 255 caracteres.');
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Código'), {
    target: { value: '01' },
  });
  fireEvent.submit(view.container.querySelector('form')!);
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        idProvincia: 99,
        importeAporte: '999999999999999.9999',
      }),
      'close',
    ),
  );
  view.rerender(
    <ObraSocialForm
      id="form"
      initial={initial}
      provincias={[]}
      busy={false}
      error={
        new ApiError('validation', 'Revisá los datos.', 400, {
          Codigo: 'Revisá el valor ingresado.',
        })
      }
      onSubmit={onSubmit}
    />,
  );
  await screen.findByText('Revisá el valor ingresado.');
  expect(screen.getByLabelText('Código')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});
