import { Select } from '@/components/ui/Select';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/http/ApiError';
import {
  getSaveDestination,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import {
  fieldLabels,
  initialFields,
  sindicatoSchema,
  toWrite,
  type SindicatoFields,
} from '../schemas/sindicatoSchema';
import type { Provincia, SindicatoWrite } from '../types/sindicato';
export function SindicatoForm({
  id,
  initial,
  provincias,
  busy,
  error,
  onSubmit,
  readOnly = false,
}: {
  id: string;
  initial?: SindicatoWrite;
  provincias: Provincia[];
  busy: boolean;
  error: unknown;
  onSubmit?: (
    data: SindicatoWrite,
    destination: SaveDestination,
  ) => Promise<void>;
  readOnly?: boolean;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SindicatoFields>({
    resolver: zodResolver(sindicatoSchema),
    defaultValues: initialFields(initial),
  });
  useEffect(() => {
    if (error instanceof ApiError)
      for (const [field, message] of Object.entries(error.fieldErrors)) {
        const key = field.charAt(0).toLowerCase() + field.slice(1);
        if (key in fieldLabels)
          setError(key as keyof SindicatoFields, { message });
      }
  }, [error, setError]);
  const field = (key: keyof SindicatoFields) => (
    <div className={`sindicato-entry sindicato-entry-${key}`} key={key}>
      <Input
        label={fieldLabels[key]}
        {...register(key)}
        readOnly={readOnly}
        error={errors[key]?.message}
        inputMode={
          key.startsWith('importe') || key.startsWith('porciento')
            ? 'decimal'
            : undefined
        }
      />
    </div>
  );
  return (
    <form
      id={id}
      className="sindicato-form"
      onSubmit={(event) => {
        if (readOnly || busy) {
          event.preventDefault();
          return;
        }
        const destination = getSaveDestination(
          (event.nativeEvent as SubmitEvent).submitter,
        );
        void handleSubmit((values) =>
          onSubmit?.(toWrite(values, initial), destination),
        )(event);
      }}
      noValidate
    >
      <fieldset
        disabled={busy}
        className="sindicato-fields"
        aria-label="Datos del sindicato"
      >
        <div className="sindicato-general">
          {field('codigo')}
          {field('nombre')}
          {field('direccion')}
          <div className="sindicato-location-row">
            {field('localidad')}
            {field('codigoPostal')}
          </div>
          <div className="sindicato-entry sindicato-entry-idProvincia">
            {readOnly ? (
              <Input
                label="Provincia"
                readOnly
                value={
                  provincias.find((p) => p.id === initial?.idProvincia)
                    ?.nombre ??
                  (initial?.idProvincia == null
                    ? ''
                    : 'Provincia ' + initial.idProvincia)
                }
              />
            ) : (
              <div className="field">
                <label htmlFor={id + '-provincia'}>Provincia</label>
                <Select
                  id={id + '-provincia'}
                  {...register('idProvincia')}
                  aria-invalid={Boolean(errors.idProvincia)}
                  aria-describedby={
                    errors.idProvincia ? id + '-provincia-error' : undefined
                  }
                >
                  <option value="">Seleccione una provincia</option>
                  {initial?.idProvincia != null &&
                    !provincias.some((p) => p.id === initial.idProvincia) && (
                      <option value={initial.idProvincia}>
                        Provincia {initial.idProvincia}
                      </option>
                    )}
                  {provincias.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre ?? 'Provincia ' + p.id}
                    </option>
                  ))}
                </Select>
                {errors.idProvincia && (
                  <p className="field-error" id={id + '-provincia-error'}>
                    {errors.idProvincia.message}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="sindicato-contact-row">
            {field('email')}
            {field('telefono')}
          </div>
        </div>
        <fieldset
          className="sindicato-contributions"
          aria-label="Aportes, retenciones y base de cálculo"
        >
          <div className="sindicato-contributions-grid">
            {field('porcientoAporte')}
            {field('importeAporte')}
            {field('porcientoRetencion')}
            {field('importeRetencion')}
            {field('baseDeCalculo')}
          </div>
        </fieldset>
      </fieldset>
    </form>
  );
}
