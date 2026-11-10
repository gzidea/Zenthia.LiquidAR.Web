import { expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BancoForm } from './BancoForm';

it('bloquea datos inválidos y envía los tres campos con su destino', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <BancoForm id="banco" busy={false} error={null} onSubmit={onSubmit} />,
  );
  fireEvent.change(screen.getByLabelText('Abreviación'), {
    target: { value: 'x'.repeat(21) },
  });
  fireEvent.submit(view.container.querySelector('form')!);
  await screen.findByText('Máximo 20 caracteres.');
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Abreviación'), {
    target: { value: 'BN' },
  });
  fireEvent.change(screen.getByLabelText('Código'), {
    target: { value: '-2' },
  });
  fireEvent.submit(view.container.querySelector('form')!);
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      { codigoEntidad: -2, denominacion: null, abreviacion: 'BN' },
      'close',
    ),
  );
});
