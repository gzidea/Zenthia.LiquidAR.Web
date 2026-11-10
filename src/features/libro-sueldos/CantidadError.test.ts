import { expect, it } from 'vitest';
import { ApiError } from '@/services/http/ApiError';
import { parseLsdExportError } from './service';

it('conserva todos los errores contextualizados de exportación', () => {
  const messages = [
    'Línea 5 · Registro 03 · Concepto 1002 · Campo cantidad: Posiciones 24–28. Valor 1200: requiere 6 posiciones (120000); admite 5 posiciones.',
    'Línea 8 · Registro 03 · Concepto 11 · Campo cantidad: Posiciones 24–28. Valor 1200: requiere 6 posiciones (120000); admite 5 posiciones.',
  ];
  const result = parseLsdExportError(
    new ApiError('validation', 'No se pudo exportar', 400),
    { errors: { cantidad: messages } },
  );
  for (const message of messages) expect(result.message).toContain(message);
  expect(result.message).toContain('Registros 03');
});

it('muestra el motivo al impedir omitir una cantidad obligatoria', () => {
  const result = parseLsdExportError(new ApiError('validation', 'Error', 400), {
    errors: {
      informarCantidadLsd: [
        'Concepto 1002, ARCA 130001: requiere informar cantidad.',
      ],
    },
  });
  expect(result.message).toContain('ARCA 130001');
  expect(result.message).toContain('Informar cantidad en TXT');
});
