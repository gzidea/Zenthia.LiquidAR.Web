import { z } from 'zod';
export const demoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Ingresá un nombre.')
    .max(120, 'Usá hasta 120 caracteres.')
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), 'Revisá el nombre.'),
  fechaIngreso: z.iso.date('Ingresá una fecha válida.'),
  convenioId: z.number().int().positive('Seleccioná un convenio.'),
  categoriaId: z.number().int().positive('Seleccioná una categoría.'),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Seleccioná un período válido.'),
});
