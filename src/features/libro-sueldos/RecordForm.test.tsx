import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecordForm, recordSchema, type FieldSpec } from './RecordForm';
import { ApiError } from '@/services/http/ApiError';
import { parseLsdError, parseLsdExportError } from './service';

const fields: FieldSpec[] = [
  { name: 'codigo', label: 'Código', kind: 'text' },
  { name: 'importe', label: 'Importe', kind: 'decimal' },
];
describe('Libro de sueldo forms and errors', () => {
  it('keeps leading zeros and monetary precision and submits the selected save destination', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <>
        <RecordForm
          id="test"
          fields={fields}
          initial={{ codigo: '0010', importe: '1234567890123.4500' }}
          busy={false}
          onSubmit={submit}
        />
        <button type="submit" form="test" value="stay">
          Guardar
        </button>
      </>,
    );
    await userEvent.click(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        { codigo: '0010', importe: '1234567890123.4500' },
        'stay',
      ),
    );
  });
  it('preserves a draft and associates API validation with its field', async () => {
    render(
      <RecordForm
        id="test"
        fields={fields}
        initial={{ codigo: 'BASICO01', importe: '1.23' }}
        busy={false}
        error={
          new ApiError('validation', 'Revisá', 400, {
            importe: 'Revisá la precisión.',
          })
        }
      />,
    );
    expect(await screen.findByText('Revisá la precisión.')).toBeVisible();
    expect(screen.getByLabelText('Código')).toHaveValue('BASICO01');
    expect(screen.getByLabelText('Importe')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
  it('blocks readonly submissions', async () => {
    const submit = vi.fn();
    render(
      <>
        <RecordForm
          id="readonly"
          fields={fields}
          initial={{ codigo: '10', importe: '1' }}
          busy={false}
          readOnly
          onSubmit={submit}
        />
        <button type="submit" form="readonly">
          Enviar
        </button>
      </>,
    );
    expect(screen.getByLabelText('Código')).toBeDisabled();
    await userEvent.click(screen.getByText('Enviar'));
    expect(submit).not.toHaveBeenCalled();
  });
  it('validates decimals without converting money to Number', () => {
    expect(
      recordSchema(fields).safeParse({ codigo: '0010', importe: '1,23' })
        .success,
    ).toBe(false);
    expect(
      recordSchema(fields).safeParse({ codigo: '0010', importe: '1.23456' })
        .success,
    ).toBe(false);
  });
  it('exposes reviewed business validation but never server failures', () => {
    const error = new ApiError('validation', 'Original', 400);
    expect(
      parseLsdError(error, {
        errors: { codigoEmpleador: ['El código ya existe para esta empresa.'] },
      }).fieldErrors.codigoEmpleador,
    ).toContain('ya existe');
    const server = new ApiError('server', 'Error del servidor', 500);
    expect(
      parseLsdError(server, { errors: { sql: ['secret internals'] } }),
    ).toBe(server);
    expect(
      parseLsdError(error, { errors: { sql: ['unreviewed internals'] } }),
    ).toBe(error);
  });
  it('explains where to fix the employer type in the book and its source', () => {
    const body = {
      errors: {
        tipoEmpresa: ['Una referencia necesaria para exportar no existe.'],
      },
    };
    const error = new ApiError('validation', 'Original', 400);
    const result = parseLsdExportError(error, body);
    expect(result.message).toContain('Registros 04 → Tipo de empleador');
    expect(result.message).toContain(
      'Empresas → Editar → Tipo de empresa AFIP',
    );
    expect(result.fieldErrors.tipoEmpresa).toBe(body.errors.tipoEmpresa[0]);
    expect(parseLsdError(error, body).message).not.toContain('Revisá');
  });
  it('directs live bank data to legajos and snapshot values to their record', () => {
    const error = new ApiError('validation', 'Original', 400);
    expect(
      parseLsdExportError(error, { errors: { cbu: ['CBU inválida.'] } })
        .message,
    ).toContain('Legajos → Editar');
    expect(
      parseLsdExportError(error, {
        errors: { condiciones: ['Referencia inexistente.'] },
      }).message,
    ).toContain('Registros 04 → Condición');
    expect(
      parseLsdExportError(error, { errors: { importe: ['Importe inválido.'] } })
        .message,
    ).toContain('Registros 03');
  });
});
