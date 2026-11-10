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
  obraSocialSchema,
  toWrite,
  type ObraSocialFields,
} from '../schemas/obraSocialSchema';
import type {
  ObraSocial,
  ObraSocialWrite,
  Provincia,
} from '../types/obraSocial';
import {
  ObraSocialFormLayout,
  type ObraSocialFieldName,
} from './ObraSocialFormLayout';

export function ObraSocialForm({
  id,
  initial,
  provincias,
  busy,
  error,
  onSubmit,
  readOnly = false,
}: {
  id: string;
  initial?: ObraSocial;
  provincias: Provincia[];
  busy: boolean;
  error: unknown;
  onSubmit?: (
    data: ObraSocialWrite,
    destination: SaveDestination,
  ) => Promise<void>;
  readOnly?: boolean;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ObraSocialFields>({
    resolver: zodResolver(obraSocialSchema),
    defaultValues: initialFields(initial),
  });
  useEffect(() => {
    if (error instanceof ApiError)
      for (const [field, message] of Object.entries(error.fieldErrors)) {
        const key = field.charAt(0).toLowerCase() + field.slice(1);
        if (key in fieldLabels)
          setError(key as keyof ObraSocialFields, { message });
      }
  }, [error, setError]);
  const field = (key: ObraSocialFieldName) => {
    let control;
    if (key === 'localidad')
      control = (
        <Input label="Localidad" value={initial?.localidad ?? ''} readOnly />
      );
    else if (key === 'idProvincia')
      control = readOnly ? (
        <Input
          label="Provincia"
          readOnly
          value={
            initial?.provinciaNombre ??
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
            {...register(key)}
            aria-invalid={Boolean(errors[key])}
            aria-describedby={errors[key] ? id + '-provincia-error' : undefined}
          >
            <option value="">Seleccione una provincia</option>
            {initial?.idProvincia != null &&
              !provincias.some((p) => p.id === initial.idProvincia) && (
                <option value={initial.idProvincia}>
                  {initial.provinciaNombre ??
                    'Provincia ' + initial.idProvincia}
                </option>
              )}
            {provincias.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre ?? 'Provincia ' + p.id}
              </option>
            ))}
          </Select>
          {errors[key] && (
            <p className="field-error" id={id + '-provincia-error'}>
              {errors[key].message}
            </p>
          )}
        </div>
      );
    else
      control = (
        <Input
          label={fieldLabels[key]}
          {...register(key)}
          readOnly={readOnly}
          error={errors[key]?.message}
          inputMode={
            key.startsWith('importe') || key.startsWith('porciento')
              ? 'decimal'
              : key === 'codigoPostal'
                ? 'numeric'
                : undefined
          }
        />
      );
    return (
      <div className={`obra-social-entry obra-social-entry-${key}`} key={key}>
        {control}
      </div>
    );
  };
  return (
    <form
      id={id}
      className="obra-social-form"
      noValidate
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
    >
      <fieldset
        disabled={busy}
        className="obra-social-fieldset"
        aria-label="Datos de la obra social"
      >
        <ObraSocialFormLayout field={field} showLocalidad={readOnly} />
      </fieldset>
    </form>
  );
}
