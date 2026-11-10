import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/services/http/ApiError';
import {
  getSaveDestination,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import type { Option, FieldSpec } from './types';
export type { FieldSpec } from './types';
type Values = Record<string, string | boolean>;
export function recordSchema(fields: FieldSpec[]) {
  return z
    .record(z.string(), z.union([z.string(), z.boolean()]))
    .superRefine((values, context) => {
      for (const field of fields) {
        const value = values[field.name];
        if (
          field.required &&
          (value === '' ||
            value === undefined ||
            (value === '0' && field.kind === 'select'))
        )
          context.addIssue({
            code: 'custom',
            path: [field.name],
            message: 'Completá este campo.',
          });
        if (value === '' || typeof value !== 'string') continue;
        if (
          (field.kind === 'integer' || field.kind === 'select') &&
          (!/^-?\d+$/.test(value) ||
            !Number.isSafeInteger(Number(value)) ||
            Number(value) < -2147483648 ||
            Number(value) > 2147483647)
        )
          context.addIssue({
            code: 'custom',
            path: [field.name],
            message: 'Ingresá un entero válido.',
          });
        if (field.kind === 'decimal' && !/^-?\d+(\.\d{1,4})?$/.test(value))
          context.addIssue({
            code: 'custom',
            path: [field.name],
            message: 'Usá punto decimal y hasta 4 decimales.',
          });
      }
    });
}
export function RecordForm<T extends object>({
  id,
  fields,
  initial,
  opciones = {},
  busy,
  readOnly = false,
  error,
  onSubmit,
  onValueChange,
}: {
  id: string;
  fields: FieldSpec[];
  initial: T;
  opciones?: Record<string, Option[]>;
  busy: boolean;
  readOnly?: boolean;
  error?: unknown;
  onSubmit?: (value: T, destination: SaveDestination) => Promise<void>;
  onValueChange?: (field: string, value: string) => void;
}) {
  const source = initial as Record<string, unknown>;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(recordSchema(fields)),
    defaultValues: Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.kind === 'boolean'
          ? Boolean(source[f.name] ?? f.name === 'informarCantidadLsd')
          : String(source[f.name] ?? ''),
      ]),
    ),
  });
  useEffect(() => {
    if (error instanceof ApiError)
      for (const [field, message] of Object.entries(error.fieldErrors))
        if (fields.some((f) => f.name === field)) setError(field, { message });
  }, [error, fields, setError]);
  return (
    <form
      id={id}
      className="lsd-form"
      noValidate
      onSubmit={(event) => {
        if (busy || readOnly) {
          event.preventDefault();
          return;
        }
        const destination = getSaveDestination(
          (event.nativeEvent as SubmitEvent).submitter,
        );
        void handleSubmit(async (values) => {
          const result: Record<string, unknown> = { ...source };
          for (const f of fields)
            result[f.name] =
              f.kind === 'boolean'
                ? Boolean(values[f.name])
                : values[f.name] === ''
                  ? null
                  : f.kind === 'integer' || f.kind === 'select'
                    ? Number(values[f.name])
                    : values[f.name];
          await onSubmit?.(result as T, destination);
        })(event);
      }}
    >
      <fieldset className="lsd-fields" disabled={busy || readOnly}>
        {fields.map((f) => (
          <div className="lsd-entry" key={f.name}>
            {f.kind === 'select' ? (
              <div className="field">
                <label htmlFor={id + '-' + f.name}>{f.label}</label>
                <Select
                  id={id + '-' + f.name}
                  {...register(f.name, {
                    onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                      onValueChange?.(f.name, e.target.value),
                  })}
                  aria-invalid={Boolean(errors[f.name])}
                  aria-describedby={
                    errors[f.name] ? id + '-' + f.name + '-error' : undefined
                  }
                >
                  <option value="">Seleccioná una opción</option>
                  {source[f.name] != null &&
                    !(opciones[f.lookup ?? ''] ?? []).some(
                      (o) => o.id === source[f.name],
                    ) && (
                      <option value={String(source[f.name])}>
                        Valor actual: {String(source[f.name])}
                      </option>
                    )}
                  {(opciones[f.lookup ?? ''] ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.codigo ? o.codigo + ' · ' : ''}
                      {o.nombre ?? o.id}
                    </option>
                  ))}
                </Select>
                {errors[f.name] && (
                  <p id={id + '-' + f.name + '-error'} className="field-error">
                    {errors[f.name]?.message}
                  </p>
                )}
              </div>
            ) : (
              <Input
                label={f.label}
                type={
                  f.kind === 'boolean'
                    ? 'checkbox'
                    : f.kind === 'date'
                      ? 'date'
                      : 'text'
                }
                {...register(f.name)}
                error={errors[f.name]?.message}
                inputMode={
                  f.kind === 'decimal'
                    ? 'decimal'
                    : f.kind === 'integer'
                      ? 'numeric'
                      : undefined
                }
              />
            )}
          </div>
        ))}
      </fieldset>
    </form>
  );
}
export function RecordSkeleton({ fields }: { fields: FieldSpec[] }) {
  return (
    <div
      className="lsd-form"
      role="status"
      aria-label="Cargando formulario…"
      aria-busy="true"
    >
      <div className="lsd-fields">
        {fields.map((f) => (
          <div className="lsd-entry" key={f.name}>
            <div className="field">
              <Skeleton width="80%" height={12} />
              <Skeleton height={28} variant="rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
