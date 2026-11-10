import { Select } from '@/components/ui/Select';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/services/http/ApiError';
import {
  getSaveDestination,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { EmpresaFormLayout } from './EmpresaFormLayout';
import { EmpresaSelector } from './EmpresaSelector';
import {
  empresaSchema,
  fieldLabels,
  initialFields,
  toWrite,
  type EmpresaFields,
  type EmpresaFieldName,
} from '../schemas/empresaSchema';
import type {
  EmpresaCompleta,
  EmpresaCompletaWrite,
  EmpresaCatalogos,
} from '../types/empresa';
const tabs = ['actividades', 'contactos', 'bancos'] as const;
export function EmpresaForm({
  id,
  initial,
  catalogos,
  busy,
  error,
  onSubmit,
  readOnly = false,
  canDelete,
  canReadActivities,
  canReadBanks,
}: {
  id: string;
  initial?: EmpresaCompleta;
  catalogos: EmpresaCatalogos;
  busy: boolean;
  error: unknown;
  onSubmit?: (
    data: EmpresaCompletaWrite,
    destination: SaveDestination,
  ) => Promise<void>;
  readOnly?: boolean;
  canDelete: boolean;
  canReadActivities: boolean;
  canReadBanks: boolean;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('actividades');
  const [selector, setSelector] = useState<'actividades' | 'bancos' | null>(
    null,
  );
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<EmpresaFields>({
    resolver: zodResolver(empresaSchema),
    defaultValues: initialFields(initial),
  });
  const contacts = useFieldArray({
    control,
    name: 'contactos',
    keyName: 'formKey',
  });
  const activities = useFieldArray({
    control,
    name: 'actividades',
    keyName: 'formKey',
  });
  const banks = useFieldArray({ control, name: 'bancos', keyName: 'formKey' });
  const submittedIndices = useRef<Record<string, number[]>>({});
  useEffect(() => {
    if (!(error instanceof ApiError)) return;
    for (const [serverPath, message] of Object.entries(error.fieldErrors)) {
      const path = serverPath.replace(
        /^(contactos|actividades|bancos)\.(\d+)\./,
        (_, kind: string, index: string) =>
          `${kind}.${submittedIndices.current[kind]?.[Number(index)] ?? index}.`,
      );
      if (
        /^(empresa\.(codigo|nombre|direccion|localidad|idProvincia|idTipoClaveUnica|claveUnica|email|telefono|idTipoEmpresaAfip)|contactos\.\d+\.(nombre|email|telefono|cargo)|actividades\.\d+\.valorSeguro)$/.test(
          path,
        )
      )
        setError(path as FieldPath<EmpresaFields>, { message });
      const firstTab = tabs.find((key) => path.startsWith(`${key}.`));
      if (firstTab) setTab(firstTab);
    }
  }, [error, setError]);
  const disabled = busy || readOnly;
  function remove(kind: (typeof tabs)[number], index: number) {
    const array =
      kind === 'contactos'
        ? contacts
        : kind === 'actividades'
          ? activities
          : banks;
    const row = getValues(kind)[index];
    if (!row || disabled || (row.id !== null && !canDelete)) return;
    if (row.id !== null) {
      const key = `${kind}Eliminar` as const;
      setValue(key, [...getValues(key), row.id], { shouldDirty: true });
    }
    array.remove(index);
  }
  const field = (key: EmpresaFieldName) => {
    const options =
      key === 'idProvincia'
        ? catalogos.provincias.map((x) => ({ id: x.id, text: x.nombre }))
        : key === 'idTipoClaveUnica'
          ? catalogos.tiposClave.map((x) => ({ id: x.id, text: x.descripcion }))
          : key === 'idTipoEmpresaAfip'
            ? catalogos.tiposEmpresa.map((x) => ({
                id: x.id,
                text: x.descripcion,
              }))
            : null;
    const previous = initial?.empresa[key];
    if (options) {
      const selected = options.find((x) => x.id === previous);
      if (readOnly)
        return (
          <Input
            label={fieldLabels[key]}
            value={selected?.text ?? previous?.toString() ?? ''}
            readOnly
          />
        );
      return (
        <div className="field">
          <label htmlFor={`${id}-${key}`}>{fieldLabels[key]}</label>
          <Select
            id={`${id}-${key}`}
            {...register(`empresa.${key}`)}
            disabled={!canReadActivities}
            aria-invalid={Boolean(errors.empresa?.[key])}
            aria-describedby={
              errors.empresa?.[key] ? `${id}-${key}-error` : undefined
            }
          >
            <option value="">Sin selección</option>
            {previous != null && !options.some((x) => x.id === previous) && (
              <option value={previous}>{previous} (valor actual)</option>
            )}
            {options.map((x) => (
              <option key={x.id} value={x.id}>
                {x.text ?? x.id}
              </option>
            ))}
          </Select>
          {errors.empresa?.[key] && (
            <p id={`${id}-${key}-error`} className="field-error">
              {errors.empresa[key]?.message}
            </p>
          )}
        </div>
      );
    }
    return (
      <Input
        label={fieldLabels[key]}
        {...register(`empresa.${key}`)}
        readOnly={readOnly}
        inputMode={key === 'codigo' ? 'numeric' : undefined}
        error={errors.empresa?.[key]?.message}
      />
    );
  };
  return (
    <>
      <form
        id={id}
        className="empresa-form"
        noValidate
        onSubmit={(event) => {
          if (disabled || selector) {
            event.preventDefault();
            return;
          }
          const destination = getSaveDestination(
            (event.nativeEvent as SubmitEvent).submitter,
          );
          void handleSubmit(
            (values) => {
              const payload = toWrite(values, initial);
              for (const kind of tabs) {
                let nextNew = 0;
                const newIndices = values[kind].flatMap((row, index) =>
                  row.id === null ? [index] : [],
                );
                submittedIndices.current[kind] = payload[kind].map((row) =>
                  row.id === null
                    ? newIndices[nextNew++]!
                    : values[kind].findIndex((x) => x.id === row.id),
                );
              }
              return onSubmit?.(payload, destination);
            },
            (invalid) => {
              const first = tabs.find((key) => invalid[key]);
              if (first) setTab(first);
            },
          )(event);
        }}
      >
        <fieldset
          className="empresa-fieldset"
          disabled={busy}
          aria-label="Datos de la empresa"
        >
          <EmpresaFormLayout field={field} />
        </fieldset>
        <div
          className="empresa-tabs"
          role="tablist"
          aria-label="Detalles de empresa"
        >
          {tabs.map((key, index) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`${id}-${key}-tab`}
              aria-selected={tab === key}
              aria-controls={`${id}-${key}-panel`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % 3
                    : event.key === 'ArrowLeft'
                      ? (index + 2) % 3
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? 2
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setTab(tabs[next]!);
                  document.getElementById(`${id}-${tabs[next]}-tab`)?.focus();
                }
              }}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)} (
              {getValues(key).length})
            </button>
          ))}
        </div>
        <section
          role="tabpanel"
          id={`${id}-actividades-panel`}
          aria-labelledby={`${id}-actividades-tab`}
          hidden={tab !== 'actividades'}
          className="empresa-tab-content"
        >
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !canReadActivities}
              onClick={() => setSelector('actividades')}
            >
              Agregar actividades
            </Button>
          )}
          {!readOnly && !canReadActivities && (
            <p>No tenés permiso para consultar el catálogo de actividades.</p>
          )}
          {!activities.fields.length && <p>No hay actividades agregadas.</p>}
          {activities.fields.map((row, i) => (
            <fieldset
              className="empresa-detail-card"
              key={row.formKey}
              disabled={busy}
              aria-label={`Actividad ${i + 1}`}
            >
              <div className="empresa-detail-data">
                <span className="empresa-detail-name">
                  {row.codigoAfip ?? row.idActividad ?? 'Sin referencia'} ·{' '}
                  {row.actividad || 'Actividad sin descripción'}
                </span>
                <label className="empresa-check">
                  <input
                    type="checkbox"
                    {...register(`actividades.${i}.activo`)}
                    disabled={disabled}
                  />
                  Activo
                </label>
              </div>
              {!readOnly && (
                <div className="empresa-detail-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || (row.id !== null && !canDelete)}
                    onClick={() => remove('actividades', i)}
                  >
                    Quitar actividad
                  </Button>
                </div>
              )}
            </fieldset>
          ))}
        </section>
        <section
          role="tabpanel"
          id={`${id}-contactos-panel`}
          aria-labelledby={`${id}-contactos-tab`}
          hidden={tab !== 'contactos'}
          className="empresa-tab-content"
        >
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                contacts.append({
                  id: null,
                  nombre: '',
                  email: '',
                  telefono: '',
                  cargo: '',
                })
              }
            >
              Agregar contacto
            </Button>
          )}
          {!contacts.fields.length && <p>No hay contactos agregados.</p>}
          {contacts.fields.map((row, i) => (
            <fieldset
              className="empresa-detail-card empresa-contacto"
              key={row.formKey}
              disabled={busy}
            >
              <legend>Contacto {i + 1}</legend>
              {(['nombre', 'email', 'telefono', 'cargo'] as const).map(
                (key) => (
                  <Input
                    key={key}
                    label={
                      {
                        nombre: 'Nombre del contacto',
                        email: 'Email del contacto',
                        telefono: 'Teléfono del contacto',
                        cargo: 'Cargo',
                      }[key]
                    }
                    {...register(`contactos.${i}.${key}`)}
                    readOnly={readOnly}
                    error={errors.contactos?.[i]?.[key]?.message}
                  />
                ),
              )}
              {!readOnly && (
                <div className="empresa-detail-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || (row.id !== null && !canDelete)}
                    onClick={() => remove('contactos', i)}
                  >
                    Quitar contacto
                  </Button>
                </div>
              )}
            </fieldset>
          ))}
        </section>
        <section
          role="tabpanel"
          id={`${id}-bancos-panel`}
          aria-labelledby={`${id}-bancos-tab`}
          hidden={tab !== 'bancos'}
          className="empresa-tab-content"
        >
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !canReadBanks}
              onClick={() => setSelector('bancos')}
            >
              Agregar bancos
            </Button>
          )}
          {!readOnly && !canReadBanks && (
            <p>No tenés permiso para consultar el catálogo de bancos.</p>
          )}
          {!banks.fields.length && <p>No hay bancos agregados.</p>}
          {banks.fields.map((row, i) => (
            <fieldset
              className="empresa-detail-card"
              key={row.formKey}
              disabled={busy}
              aria-label={`Banco ${i + 1}`}
            >
              <div className="empresa-detail-data">
                <span className="empresa-detail-name">
                  {row.banco || `Banco ${row.idBanco}`}{' '}
                  {row.abreviacion ? `(${row.abreviacion})` : ''}
                </span>
                <label className="empresa-check">
                  <input
                    type="checkbox"
                    {...register(`bancos.${i}.activo`)}
                    disabled={disabled}
                  />
                  Activo
                </label>
              </div>
              {!readOnly && (
                <div className="empresa-detail-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || (row.id !== null && !canDelete)}
                    onClick={() => remove('bancos', i)}
                  >
                    Quitar banco
                  </Button>
                </div>
              )}
            </fieldset>
          ))}
        </section>
        {!readOnly && !canDelete && (
          <p className="field-note">
            Podés quitar filas nuevas. Quitar asociaciones guardadas requiere
            permiso de eliminación.
          </p>
        )}
      </form>
      {selector && (
        <EmpresaSelector
          kind={selector}
          existing={
            selector === 'actividades'
              ? getValues('actividades').flatMap((x) =>
                  x.idActividad === null ? [] : [x.idActividad],
                )
              : getValues('bancos').map((x) => x.idBanco)
          }
          onClose={() => setSelector(null)}
          onAdd={(rows) => {
            if (selector === 'actividades')
              activities.append(
                rows.map((x) => ({
                  id: null,
                  idActividad: x.id,
                  codigoAfip: x.codigo === '' ? null : Number(x.codigo),
                  actividad: x.nombre,
                  valorSeguro: '0',
                  activo: false,
                })),
              );
            else
              banks.append(
                rows.map((x) => ({
                  id: null,
                  idBanco: x.id,
                  banco: x.nombre,
                  abreviacion: x.abreviacion,
                  activo: false,
                })),
              );
          }}
        />
      )}
    </>
  );
}
