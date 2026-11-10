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
  bancoSchema,
  initialFields,
  toWrite,
  fieldLabels,
  type BancoFields,
} from '../schemas/bancoSchema';
import type { BancoWrite } from '../types/banco';

export function BancoForm({
  id,
  initial,
  busy,
  error,
  readOnly = false,
  onSubmit,
}: {
  id: string;
  initial?: BancoWrite;
  busy: boolean;
  error: unknown;
  readOnly?: boolean;
  onSubmit?: (data: BancoWrite, destination: SaveDestination) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BancoFields>({
    resolver: zodResolver(bancoSchema),
    defaultValues: initialFields(initial),
  });
  useEffect(() => {
    if (error instanceof ApiError)
      for (const [field, message] of Object.entries(error.fieldErrors)) {
        const key = field.charAt(0).toLowerCase() + field.slice(1);
        if (Object.hasOwn(fieldLabels, key))
          setError(key as keyof BancoFields, { message });
      }
  }, [error, setError]);
  return (
    <form
      id={id}
      className="banco-form"
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
        className="banco-fields"
        disabled={busy}
        aria-label="Datos del banco"
      >
        {(Object.keys(fieldLabels) as (keyof BancoFields)[]).map((key) => (
          <div className={`banco-entry banco-entry-${key}`} key={key}>
            <Input
              label={fieldLabels[key]}
              {...register(key)}
              error={errors[key]?.message}
              readOnly={readOnly}
              inputMode={key === 'codigoEntidad' ? 'numeric' : undefined}
            />
          </div>
        ))}
      </fieldset>
    </form>
  );
}
