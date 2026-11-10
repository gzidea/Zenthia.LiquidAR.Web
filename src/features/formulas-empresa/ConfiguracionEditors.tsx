import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import {
  FormDialogActions,
  getSaveDestination,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { errorMessage } from '@/services/http/ApiError';
import { FormulaForm } from '@/features/formulas/components/FormulaForm';
import type {
  CatalogKind,
  Catalogo,
  FormulaCompleta,
  FormulaWrite,
} from '@/features/formulas/types/formula';
import type {
  Agrupacion,
  AgrupacionWrite,
  Exclusion,
  ExclusionWrite,
  OpcionFormula,
  Catalogos,
  Publicacion,
  PublicacionWrite,
} from './service';

export const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const periodoApi = (month: string) =>
  month.slice(5, 7) + month.slice(0, 4);
const vigencia = {
  desde: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Indique un período válido.'),
  hasta: z.string(),
};
const fechasValidas = (value: { desde: string; hasta: string }) =>
  !value.hasta ||
  (/^\d{4}-(0[1-9]|1[0-2])$/.test(value.hasta) && value.hasta >= value.desde);
const grupoSchema = z
  .object({
    descripcion: z.string().trim().min(1, 'Indique una descripción.').max(255),
    orden: z.number().int().min(0),
    ...vigencia,
    activa: z.boolean(),
    formulas: z
      .array(z.number().int().positive())
      .min(2, 'Seleccione al menos dos fórmulas.'),
  })
  .refine(fechasValidas, {
    message: 'Hasta debe ser igual o posterior a Desde.',
    path: ['hasta'],
  });
type GrupoFields = z.infer<typeof grupoSchema>;

export function AgrupacionEditor({
  initial,
  opciones,
  busy,
  readOnly,
  error,
  onClose,
  onSave,
  onUndo,
}: {
  initial?: Agrupacion;
  opciones: OpcionFormula[];
  busy: boolean;
  readOnly: boolean;
  error: unknown;
  onClose: () => void;
  onUndo: () => void;
  onSave: (
    value: AgrupacionWrite,
    destination: SaveDestination,
  ) => Promise<void>;
}) {
  const id = useId();
  const form = useForm<GrupoFields>({
    resolver: zodResolver(grupoSchema),
    defaultValues: {
      descripcion: initial?.descripcion ?? '',
      orden: initial?.orden ?? 0,
      desde: initial?.periodoDesde.slice(0, 7) ?? mesActual(),
      hasta: initial?.periodoHasta?.slice(0, 7) ?? '',
      activa: initial?.activa ?? true,
      formulas: initial?.formulas ?? [],
    },
  });
  const seleccion = form.watch('formulas');
  return (
    <Modal
      open
      size="large"
      title={
        readOnly
          ? 'Ver agrupación'
          : initial
            ? 'Editar agrupación'
            : 'Nueva agrupación'
      }
      onClose={onClose}
      closeDisabled={busy}
      cancelButton={{ label: readOnly ? 'Cerrar' : 'Cancelar', disabled: busy }}
      acceptButton={
        readOnly
          ? false
          : {
              label: 'Guardar y cerrar',
              type: 'submit',
              form: id,
              loading: busy,
            }
      }
      actions={
        readOnly ? undefined : (
          <FormDialogActions
            form={id}
            busy={busy}
            loading={false}
            hasError={false}
            onUndo={onUndo}
          />
        )
      }
    >
      <p>
        Las fórmulas se calculan por separado y se muestran en una sola línea.
        El desglose se conserva.
      </p>
      {error != null && <p role="alert">{errorMessage(error)}</p>}
      <form
        id={id}
        className="formula-config-form"
        onSubmit={(event) => {
          const destino = getSaveDestination(
            (event.nativeEvent as SubmitEvent).submitter,
          );
          void form.handleSubmit((value) =>
            onSave(
              {
                descripcion: value.descripcion,
                orden: value.orden,
                periodoDesde: periodoApi(value.desde),
                periodoHasta: value.hasta ? periodoApi(value.hasta) : null,
                activa: value.activa,
                formulas: value.formulas,
                revisionEsperada: initial?.revision ?? 0,
              },
              destino,
            ),
          )(event);
        }}
      >
        <fieldset disabled={busy || readOnly}>
          <Input
            label="Descripción en el recibo"
            {...form.register('descripcion')}
            error={form.formState.errors.descripcion?.message}
          />
          <Input
            label="Posición (desde 0)"
            type="number"
            min={0}
            {...form.register('orden', { valueAsNumber: true })}
            error={form.formState.errors.orden?.message}
          />
          <Input
            label="Desde"
            type="month"
            {...form.register('desde')}
            error={form.formState.errors.desde?.message}
          />
          <Input
            label="Hasta"
            type="month"
            {...form.register('hasta')}
            error={form.formState.errors.hasta?.message}
          />
          <label className="formula-config-check">
            <input type="checkbox" {...form.register('activa')} />
            Activa
          </label>
          <fieldset className="formula-config-options">
            <legend>Fórmulas integrantes</legend>
            {opciones.map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  checked={seleccion.includes(f.id)}
                  onChange={(event) =>
                    form.setValue(
                      'formulas',
                      event.target.checked
                        ? [...seleccion, f.id]
                        : seleccion.filter((id) => id !== f.id),
                      { shouldValidate: true },
                    )
                  }
                />
                {f.codigo ?? 'Sin código'} · {f.descripcion}
              </label>
            ))}
            {initial?.formulas
              .filter((id) => !opciones.some((f) => f.id === id))
              .map((id) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={seleccion.includes(id)}
                    onChange={() =>
                      form.setValue(
                        'formulas',
                        seleccion.filter((f) => f !== id),
                        { shouldValidate: true },
                      )
                    }
                  />
                  Fórmula {id} · ya no disponible en convenios habilitados
                </label>
              ))}
          </fieldset>
          {form.formState.errors.formulas && (
            <p role="alert">{form.formState.errors.formulas.message}</p>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}

const exclusionSchema = z
  .object({
    formula: z.string().min(1, 'Seleccione una fórmula central.'),
    ...vigencia,
    activa: z.boolean(),
  })
  .refine(fechasValidas, {
    message: 'Hasta debe ser igual o posterior a Desde.',
    path: ['hasta'],
  });
export function ExclusionEditor({
  initial,
  opciones,
  busy,
  readOnly,
  error,
  onClose,
  onSave,
  onUndo,
}: {
  initial?: Exclusion;
  opciones: OpcionFormula[];
  busy: boolean;
  readOnly: boolean;
  error: unknown;
  onClose: () => void;
  onUndo: () => void;
  onSave: (data: ExclusionWrite, destino: SaveDestination) => Promise<void>;
}) {
  const id = useId();
  const form = useForm<z.infer<typeof exclusionSchema>>({
    resolver: zodResolver(exclusionSchema),
    defaultValues: {
      formula: initial ? String(initial.idFormula) : '',
      desde: initial?.periodoDesde.slice(0, 7) ?? mesActual(),
      hasta: initial?.periodoHasta?.slice(0, 7) ?? '',
      activa: initial?.activa ?? true,
    },
  });
  return (
    <Modal
      open
      title={
        readOnly
          ? 'Ver exclusión'
          : initial
            ? 'Editar exclusión'
            : 'Excluir fórmula del cálculo'
      }
      onClose={onClose}
      closeDisabled={busy}
      cancelButton={{ label: readOnly ? 'Cerrar' : 'Cancelar', disabled: busy }}
      acceptButton={
        readOnly
          ? false
          : {
              label: 'Guardar y cerrar',
              type: 'submit',
              form: id,
              loading: busy,
            }
      }
      actions={
        readOnly ? undefined : (
          <FormDialogActions
            form={id}
            busy={busy}
            loading={false}
            hasError={false}
            onUndo={onUndo}
          />
        )
      }
    >
      <p>
        Esta acción deja de calcular la fórmula para esta empresa. Para mostrar
        varias fórmulas como una sola línea, use Agrupaciones.
      </p>
      {error != null && <p role="alert">{errorMessage(error)}</p>}
      <form
        id={id}
        className="formula-config-form"
        onSubmit={(event) => {
          const destino = getSaveDestination(
            (event.nativeEvent as SubmitEvent).submitter,
          );
          void form.handleSubmit((value) =>
            onSave(
              {
                idFormula: Number(value.formula),
                periodoDesde: periodoApi(value.desde),
                periodoHasta: value.hasta ? periodoApi(value.hasta) : null,
                activa: value.activa,
                revisionEsperada: initial?.revision ?? 0,
              },
              destino,
            ),
          )(event);
        }}
      >
        <fieldset disabled={busy || readOnly}>
          <div className="field">
            <label htmlFor={`${id}-formula`}>Fórmula central</label>
            <Select
              id={`${id}-formula`}
              {...form.register('formula')}
              disabled={Boolean(initial) || busy || readOnly}
            >
              <option value="">Seleccione una fórmula</option>
              {opciones
                .filter((f) => f.idEmpresa == null)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.codigo} · {f.descripcion}
                  </option>
                ))}
              {initial && !opciones.some((f) => f.id === initial.idFormula) && (
                <option value={initial.idFormula}>
                  Fórmula {initial.idFormula} · no disponible
                </option>
              )}
            </Select>
          </div>
          {form.formState.errors.formula && (
            <p role="alert">{form.formState.errors.formula.message}</p>
          )}
          <Input
            label="Desde"
            type="month"
            {...form.register('desde')}
            error={form.formState.errors.desde?.message}
          />
          <Input
            label="Hasta"
            type="month"
            {...form.register('hasta')}
            error={form.formState.errors.hasta?.message}
          />
          <label className="formula-config-check">
            <input type="checkbox" {...form.register('activa')} />
            Exclusión activa (desmarcar restaura la fórmula central)
          </label>
        </fieldset>
      </form>
    </Modal>
  );
}

export function completaDesdePublicacion(
  value: Publicacion,
): FormulaCompleta | undefined {
  const p = value.publicacion;
  if (!p) return undefined;
  return {
    formula: {
      ...p.formula,
      convenioNombre: null,
      conceptoDescripcion: null,
      unidadDescripcion: null,
      descripcionCompleta: p.descripcionCompleta,
      variable: `C${p.formula.convenioId ?? ''}${p.formula.codigo ?? ''}`,
    },
    periodos: p.meses.map((numeroMes) => ({
      id: null,
      numeroMes,
      seleccionado: true,
    })),
    tiposLiquidacion: p.tiposLiquidacion.map((idTipoLiquidacion) => ({
      id: null,
      idTipoLiquidacion,
      seleccionado: true,
    })),
  };
}
const publicacionSchema = z.object(vigencia).refine(fechasValidas, {
  message: 'Hasta debe ser igual o posterior a Desde.',
  path: ['hasta'],
});
export function FormulaEmpresaEditor({
  initial,
  origen,
  catalogos,
  busy,
  readOnly,
  error,
  onClose,
  onSave,
  onUndo,
  central = false,
}: {
  initial?: Publicacion;
  origen?: number;
  catalogos: Catalogos;
  busy: boolean;
  readOnly: boolean;
  error: unknown;
  onClose: () => void;
  onUndo: () => void;
  onSave: (data: PublicacionWrite, destino: SaveDestination) => Promise<void>;
  central?: boolean;
}) {
  const form = useForm<z.infer<typeof publicacionSchema>>({
    resolver: zodResolver(publicacionSchema),
    defaultValues: {
      desde: origen
        ? mesActual()
        : (initial?.periodoDesde?.slice(0, 7) ?? mesActual()),
      hasta: origen ? '' : (initial?.periodoHasta?.slice(0, 7) ?? ''),
    },
  });
  const overrides: Record<CatalogKind, Catalogo[]> = {
    ...catalogos,
    tipoliquidacion: catalogos.tiposLiquidacion,
  };
  const submit = async (data: FormulaWrite, destino: SaveDestination) => {
    if (!(await form.trigger())) return;
    const v = form.getValues();
    await onSave(
      {
        formula: data.formula,
        meses: data.periodos
          .filter((p) => p.seleccionado && p.numeroMes != null)
          .map((p) => p.numeroMes!),
        tiposLiquidacion: data.tiposLiquidacion
          .filter((t) => t.seleccionado && t.idTipoLiquidacion != null)
          .map((t) => t.idTipoLiquidacion!),
        periodoDesde: periodoApi(v.desde),
        periodoHasta: v.hasta ? periodoApi(v.hasta) : null,
        revisionEsperada: origen ? 0 : (initial?.revision ?? 0),
        idFormulaCentralOrigen:
          origen ?? initial?.idFormulaCentralOrigen ?? null,
      },
      destino,
    );
  };
  return (
    <Modal
      open
      size="large"
      title={
        central
          ? 'Publicar versión central'
          : readOnly
            ? 'Ver fórmula de empresa'
            : origen
              ? 'Personalizar fórmula central'
              : initial
                ? 'Publicar versión de empresa'
                : 'Nueva fórmula de empresa'
      }
      onClose={onClose}
      closeDisabled={busy}
      cancelButton={{ label: readOnly ? 'Cerrar' : 'Cancelar', disabled: busy }}
      acceptButton={
        readOnly
          ? false
          : {
              label: 'Guardar y cerrar',
              type: 'submit',
              form: 'formula-form',
              loading: busy,
            }
      }
      actions={
        readOnly ? undefined : (
          <FormDialogActions
            form="formula-form"
            busy={busy}
            loading={false}
            hasError={false}
            onUndo={onUndo}
            allowNew={!central}
          />
        )
      }
    >
      {initial && (
        <p>
          Una fórmula publicada conserva su código y convenio. Para cambiarlos,
          cree una fórmula nueva.
        </p>
      )}
      {(origen ?? initial?.idFormulaCentralOrigen) != null && (
        <p>
          Este reemplazo conserva el código y el orden de la fórmula central.
          Desactive una versión para volver al cálculo central.
        </p>
      )}
      <div className="formula-config-periodos">
        <Input
          label="Aplicar desde"
          type="month"
          disabled={busy || readOnly}
          {...form.register('desde')}
          error={form.formState.errors.desde?.message}
        />
        <Input
          label="Aplicar hasta"
          type="month"
          disabled={busy || readOnly}
          {...form.register('hasta')}
          error={form.formState.errors.hasta?.message}
        />
      </div>
      <FormulaForm
        initial={initial ? completaDesdePublicacion(initial) : undefined}
        busy={busy}
        readOnly={readOnly}
        canDelete={!readOnly}
        error={error}
        catalogos={overrides}
        allowClone={false}
        onSubmit={submit}
      />
    </Modal>
  );
}
