import { Select } from '@/components/ui/Select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  categoriaFields,
  categoriaSchema,
  categoriaWrite,
  type CategoriaFields,
} from '../schemas/convenioSchema';
import type { CategoriaCambio } from '../types/convenio';
export function CategoriaEditor({
  initial,
  onClose,
  onApply,
  readOnly = false,
}: {
  initial?: CategoriaCambio;
  onClose: () => void;
  onApply: (value: CategoriaCambio) => void;
  readOnly?: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CategoriaFields>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: categoriaFields(initial),
  });
  const inicial = watch('inicial');
  const text = (key: keyof CategoriaFields, label: string, type = 'text') => (
    <Input
      key={key}
      label={label}
      type={type}
      readOnly={readOnly}
      {...register(key)}
      error={errors[key]?.message}
    />
  );
  const actual = initial?.condicionLiquidacion;
  return (
    <Modal
      open
      title={
        readOnly
          ? 'Ver categoría'
          : initial
            ? 'Editar categoría'
            : 'Nueva categoría'
      }
      onClose={onClose}
      acceptButton={
        readOnly
          ? false
          : {
              label: initial ? 'Aplicar cambios' : 'Agregar al convenio',
              type: 'submit',
              form: 'categoria-draft',
            }
      }
      cancelButton={{ label: readOnly ? 'Cerrar' : 'Cancelar' }}
    >
      <form
        id="categoria-draft"
        className="convenio-form convenio-fields"
        noValidate
        onSubmit={handleSubmit(
          (values) =>
            !readOnly && onApply(categoriaWrite(values, initial?.id ?? null)),
        )}
      >
        {text('codigo', 'Código')}
        {text('descripcion', 'Descripción')}
        <div className="field">
          <label htmlFor="categoria-condicion">Condición</label>
          <Select
            id="categoria-condicion"
            disabled={readOnly}
            {...register('condicionLiquidacion')}
          >
            <option value="">Sin selección</option>
            <option value="0">Jornal</option>
            <option value="1">Mensual</option>
            {actual != null && actual !== 0 && actual !== 1 && (
              <option value={actual}>{actual} (valor actual)</option>
            )}
          </Select>
        </div>
        {text('horasNormales', 'Horas normales')}
        {text('horasMinimasImponibles', 'Horas mínimas imponibles')}
        {text('diasMinimosImponibles', 'Días mínimos imponibles')}
        {initial?.id == null && (
          <label className="convenio-check">
            <input
              type="checkbox"
              {...register('inicial')}
              disabled={readOnly}
            />
            Cargar escala inicial
          </label>
        )}
        {inicial && (
          <fieldset className="convenio-fields">
            <legend>Escala inicial</legend>
            {text('mes', 'Desde', 'month')}
            {text('importe', 'Importe')}
            {text('adicional1', 'Adicional 1')}
            {text('adicional2', 'Adicional 2')}
            {text('motivo', 'Motivo')}
            <p>
              Un importe vacío se guarda sin valor; cero se conserva como cero.
            </p>
          </fieldset>
        )}
        <p className="field-note">
          Los cambios se guardarán junto con el convenio.
        </p>
      </form>
    </Modal>
  );
}
