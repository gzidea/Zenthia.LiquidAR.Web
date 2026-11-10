import { Select } from '@/components/ui/Select';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  getSaveDestination,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { ApiError } from '@/services/http/ApiError';
import {
  legajoSchema,
  toFields,
  toData,
  dateFields,
  integerFields,
  type Fields,
} from '../schemas/legajoSchema';
import type { Completo, Concepto, Write } from '../types/legajo';
import { useCatalogo } from '../hooks/useLegajos';
import {
  labels,
  catalogs,
  personal,
  empresa,
  laboral,
  sicoss,
  type FieldName,
} from './legajoFields';
import { LegajoSelect } from './LegajoSelect';
import { ConceptoSelector } from './ConceptoSelector';
import { ConceptoEditor } from './ConceptoEditor';
function Group({
  title,
  fields,
  field,
}: {
  title: string;
  fields: FieldName[];
  field: (name: FieldName) => ReactNode;
}) {
  return (
    <fieldset className="legajo-group">
      <legend>{title}</legend>
      <div className="legajo-group-fields">
        {fields.map((n) => (
          <div key={n}>{field(n)}</div>
        ))}
      </div>
    </fieldset>
  );
}
export function LegajoForm({
  initial,
  busy,
  readOnly,
  error,
  onSubmit,
}: {
  initial?: Completo;
  busy: boolean;
  readOnly: boolean;
  error: Error | null;
  onSubmit: (value: Write, destination: SaveDestination) => Promise<void>;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const form = useForm<Fields>({
    resolver: zodResolver(legajoSchema),
    defaultValues: toFields(initial?.legajo),
  });
  const {
    register,
    watch,
    setValue,
    setError,
    handleSubmit,
    formState: { errors },
  } = form;
  const [tab, setTab] = useState('laborales');
  const [conceptos, setConceptos] = useState<Concepto[]>(
    initial?.conceptos ?? [],
  );
  const [deleted, setDeleted] = useState<number[]>([]);
  const [selector, setSelector] = useState(false);
  const [edit, setEdit] = useState<number | null>(null);
  const convenio = Number(watch('idConvenio')) || null;
  const company = Number(watch('idEmpresa')) || null;
  const formulas = useCatalogo('formulas', convenio);
  const tipos = useCatalogo('tipos-liquidacion');
  useEffect(() => {
    if (apiError?.fieldErrors)
      for (const [key, messages] of Object.entries(apiError.fieldErrors)) {
        const name = key.replace(/^legajo\./, '');
        if (name in labels) setError(name as FieldName, { message: messages });
        if (sicoss.includes(name as FieldName)) setTab('sicoss');
        if (key.startsWith('conceptos')) setTab('conceptos');
      }
  }, [apiError, setError]);
  const field = (name: FieldName) => {
    const title = labels[name];
    const err = errors[name]?.message;
    const tipo = catalogs[name];
    if (tipo)
      return (
        <LegajoSelect
          title={title}
          tipo={tipo}
          parent={
            name === 'idActividad'
              ? company
              : name === 'idCategoria'
                ? convenio
                : undefined
          }
          value={String(watch(name))}
          onChange={(v) => setValue(name, v, { shouldDirty: true })}
          disabled={busy || readOnly}
          error={err}
        />
      );
    if (name === 'fueraconvenio')
      return (
        <label className="legajo-check">
          <input
            type="checkbox"
            {...register(name)}
            disabled={busy || readOnly}
          />
          {title}
        </label>
      );
    if (name === 'conyuge')
      return (
        <div className="field">
          <label htmlFor="legajo-conyuge">{title}</label>
          <Select
            id="legajo-conyuge"
            {...register(name)}
            disabled={busy || readOnly}
          >
            <option value="">Sin informar</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </Select>
        </div>
      );
    return (
      <Input
        label={title}
        {...register(name)}
        type={dateFields.has(name) ? 'date' : 'text'}
        inputMode={
          integerFields.has(name)
            ? 'numeric'
            : name === 'sueldo' || name === 'adicional'
              ? 'decimal'
              : undefined
        }
        disabled={busy || readOnly}
        error={err}
      />
    );
  };
  const nameOf = (
    id: number | null,
    options: { id: number; nombre: string | null }[] | undefined,
  ) =>
    options?.find((x) => x.id === id)?.nombre ??
    (id === null ? 'Sin selección' : `ID ${id}`);
  return (
    <>
      <form
        id="legajo-form"
        className="legajo-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || readOnly) return;
          const dest = getSaveDestination(
            (e.nativeEvent as SubmitEvent).submitter,
          );
          void handleSubmit(
            async (values) => {
              const data: Write = {
                legajo: toData(values, initial?.legajo),
                conceptos: conceptos.map(({ id, ...datos }) => ({ id, datos })),
                conceptosEliminar: deleted,
              };
              await onSubmit(data, dest);
            },
            (invalid) =>
              setTab(
                Object.keys(invalid).some((k) =>
                  sicoss.includes(k as FieldName),
                )
                  ? 'sicoss'
                  : 'laborales',
              ),
          )(e);
        }}
      >
        <fieldset className="legajo-fieldset" disabled={busy}>
          <div className="legajo-groups">
            <Group title="Datos personales" fields={personal} field={field} />
            <Group title="Empresa y actividad" fields={empresa} field={field} />
          </div>
          <div
            className="legajo-tabs"
            role="tablist"
            aria-label="Datos del legajo"
          >
            {[
              ['laborales', 'Datos laborales'],
              ['conceptos', `Conceptos particulares (${conceptos.length})`],
              ['sicoss', 'SICOSS'],
            ].map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id!)}
              >
                {text}
              </button>
            ))}
          </div>
          <div
            className="legajo-tab-content"
            role="tabpanel"
            id="panel-laborales"
            aria-labelledby="tab-laborales"
            hidden={tab !== 'laborales'}
          >
            <div className="legajo-groups">
              {laboral.map(([title, fields]) => (
                <Group
                  key={title}
                  title={title}
                  fields={fields}
                  field={field}
                />
              ))}
              {initial && (
                <p>
                  Antigüedad guardada:{' '}
                  {initial.antiguedad || 'Sin fecha reconocida'}
                </p>
              )}
            </div>
          </div>
          <div
            className="legajo-tab-content"
            role="tabpanel"
            id="panel-conceptos"
            aria-labelledby="tab-conceptos"
            hidden={tab !== 'conceptos'}
          >
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy || !convenio}
                onClick={() => setSelector(true)}
              >
                Agregar conceptos
              </Button>
            )}
            {!convenio && <p>Seleccioná un convenio para agregar conceptos.</p>}
            {apiError?.fieldErrors &&
              Object.entries(apiError.fieldErrors)
                .filter(([key]) => key.startsWith('conceptos'))
                .map(([key, messages]) => (
                  <p role="alert" key={key}>
                    {messages}
                  </p>
                ))}
            {!conceptos.length && <p>No hay conceptos particulares.</p>}
            {conceptos.map((row, i) => (
              <fieldset
                className="legajo-detail-card"
                key={row.id ?? `new-${i}`}
                disabled={busy}
              >
                <div className="legajo-detail-data">
                  <span className="legajo-detail-name">
                    {nameOf(row.idFormula, formulas.data)}
                  </span>
                  <span className="legajo-detail-summary">
                    {nameOf(row.idTipoLiquidacion, tipos.data)} · Cantidad:{' '}
                    {row.cantidad ?? '—'} · Importe: {row.importe ?? '—'}
                    <br />
                    {row.vigenteDesde?.slice(0, 10) ?? 'Sin inicio'} /{' '}
                    {row.vigenteHasta?.slice(0, 10) ?? 'Sin fin'}
                  </span>
                  <label className="legajo-check">
                    <input
                      type="checkbox"
                      checked={row.activo}
                      disabled={readOnly || busy}
                      onChange={(e) =>
                        setConceptos((values) =>
                          values.map((v, j) =>
                            j === i ? { ...v, activo: e.target.checked } : v,
                          ),
                        )
                      }
                    />
                    Activo
                  </label>
                </div>
                {!readOnly && (
                  <div className="legajo-detail-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEdit(i)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (row.id !== null) setDeleted((v) => [...v, row.id!]);
                        setConceptos((v) => v.filter((_, j) => j !== i));
                      }}
                    >
                      Quitar
                    </Button>
                  </div>
                )}
              </fieldset>
            ))}
          </div>
          <div
            className="legajo-tab-content"
            role="tabpanel"
            id="panel-sicoss"
            aria-labelledby="tab-sicoss"
            hidden={tab !== 'sicoss'}
          >
            <Group title="SICOSS" fields={sicoss} field={field} />
            {initial && (
              <p>
                Situación de revista guardada:{' '}
                {initial.situacionRevistaActual ?? 'Sin informar'}
              </p>
            )}
          </div>
        </fieldset>
      </form>
      {selector && (
        <ConceptoSelector
          convenio={convenio!}
          onClose={() => setSelector(false)}
          onAdd={(rows) =>
            setConceptos((v) => [
              ...v,
              ...rows.map((r) => ({
                id: null,
                idLegajo: initial?.legajo.id ?? null,
                idFormula: r.id,
                idTipoLiquidacion: null,
                cantidad: null,
                importe: null,
                activo: true,
                vigenteDesde: null,
                vigenteHasta: null,
              })),
            ])
          }
        />
      )}
      {edit !== null && (
        <ConceptoEditor
          row={conceptos[edit]!}
          convenio={convenio}
          onClose={() => setEdit(null)}
          onSave={(value) => {
            setConceptos((v) => v.map((row, i) => (i === edit ? value : row)));
            setEdit(null);
          }}
        />
      )}
    </>
  );
}
export function LegajoFormSkeleton() {
  const field = () => (
    <div className="field">
      <Skeleton width="80%" height={13} />
      <Skeleton height={28} />
    </div>
  );
  return (
    <div className="legajo-form" aria-label="Cargando legajo" aria-busy="true">
      <div className="legajo-groups">
        <Group title="Datos personales" fields={personal} field={field} />
        <Group title="Empresa y actividad" fields={empresa} field={field} />
      </div>
      <div className="legajo-tabs legajo-tabs-skeleton" aria-hidden="true">
        <span>Datos laborales</span>
        <span>Conceptos particulares</span>
        <span>SICOSS</span>
      </div>
      <div className="legajo-tab-content legajo-groups">
        {laboral.map(([title, fields]) => (
          <Group key={title} title={title} fields={fields} field={field} />
        ))}
      </div>
    </div>
  );
}
