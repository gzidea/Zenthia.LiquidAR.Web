import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { LegajoSelect } from './LegajoSelect';
import { decimal } from '../schemas/legajoSchema';
import type { Concepto } from '../types/legajo';
const schema = z.object({
  idFormula: z.string(),
  idTipoLiquidacion: z.string(),
  cantidad: z
    .string()
    .refine(
      (v) =>
        v === '' ||
        (/^-?(\d+(\.\d*)?|\.\d+)$/.test(v) && Number.isFinite(Number(v))),
      'Cantidad inválida.',
    ),
  importe: decimal,
  activo: z.boolean(),
  vigenteDesde: z.string(),
  vigenteHasta: z.string(),
});
export function ConceptoEditor({
  row,
  convenio,
  onSave,
  onClose,
}: {
  row: Concepto;
  convenio: number | null;
  onSave: (value: Concepto) => void;
  onClose: () => void;
}) {
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      idFormula: String(row.idFormula ?? ''),
      idTipoLiquidacion: String(row.idTipoLiquidacion ?? ''),
      cantidad: String(row.cantidad ?? ''),
      importe: row.importe ?? '',
      activo: row.activo,
      vigenteDesde: row.vigenteDesde?.slice(0, 10) ?? '',
      vigenteHasta: row.vigenteHasta?.slice(0, 10) ?? '',
    },
  });
  return (
    <Modal
      open
      title="Editar concepto particular"
      onClose={onClose}
      acceptButton={{
        label: 'Aplicar al borrador',
        type: 'submit',
        form: 'concepto-form',
      }}
    >
      <form
        id="concepto-form"
        className="legajo-form"
        onSubmit={handleSubmit((v) =>
          onSave({
            ...row,
            idFormula: v.idFormula === '' ? null : Number(v.idFormula),
            idTipoLiquidacion:
              v.idTipoLiquidacion === '' ? null : Number(v.idTipoLiquidacion),
            cantidad: v.cantidad === '' ? null : Number(v.cantidad),
            importe:
              v.importe === String(row.importe ?? '')
                ? row.importe
                : v.importe || null,
            activo: v.activo,
            vigenteDesde:
              v.vigenteDesde === (row.vigenteDesde?.slice(0, 10) ?? '')
                ? row.vigenteDesde
                : v.vigenteDesde || null,
            vigenteHasta:
              v.vigenteHasta === (row.vigenteHasta?.slice(0, 10) ?? '')
                ? row.vigenteHasta
                : v.vigenteHasta || null,
          }),
        )}
      >
        <div className="legajo-groups">
          <LegajoSelect
            title="Fórmula"
            tipo="formulas"
            parent={convenio}
            value={watch('idFormula')}
            onChange={(v) => setValue('idFormula', v)}
            disabled={false}
          />
          <LegajoSelect
            title="Tipo de liquidación"
            tipo="tipos-liquidacion"
            value={watch('idTipoLiquidacion')}
            onChange={(v) => setValue('idTipoLiquidacion', v)}
            disabled={false}
          />
          <Input
            label="Cantidad"
            {...register('cantidad')}
            error={errors.cantidad?.message}
          />
          <Input
            label="Importe"
            {...register('importe')}
            error={errors.importe?.message}
          />
          <Input
            label="Vigente desde"
            type="date"
            {...register('vigenteDesde')}
          />
          <Input
            label="Vigente hasta"
            type="date"
            {...register('vigenteHasta')}
          />
          <label className="legajo-check">
            <input type="checkbox" {...register('activo')} />
            Activo
          </label>
        </div>
      </form>
    </Modal>
  );
}
