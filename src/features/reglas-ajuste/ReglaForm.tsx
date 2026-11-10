import { Select } from '@/components/ui/Select';
import { useId, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  getSaveDestination,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { errorMessage } from '@/services/http/ApiError';
import { fields, payload, reglaSchema, type Fields } from './schema';
import {
  month,
  nuevaCondicion,
  operaciones,
  periodoTexto,
  type Destino,
  type ReglaWrite,
  type Version,
} from './types';
import { useDestinos } from './hooks';
import { DestinoSelector } from './Selectors';
import { CondicionEditor } from './CondicionEditor';

export function ReglaFormSkeleton() {
  return (
    <div
      className="regla-form"
      role="status"
      aria-label="Cargando formulario de regla"
    >
      <div className="regla-general" aria-hidden="true">
        {[
          'Nombre',
          'Desde',
          'Hasta',
          'Estado',
          'Operación',
          'Valor',
          'Motivo',
        ].map((x) => (
          <div
            className={`field ${x === 'Nombre' || x === 'Motivo' ? 'regla-wide' : ''}`}
            key={x}
          >
            <label>{x}</label>
            <Skeleton height="28px" />
          </div>
        ))}
      </div>
      <Skeleton height="100px" />
      <Skeleton height="100px" />
    </div>
  );
}
export function ReglaForm({
  nombre,
  version,
  revision,
  editing,
  readOnly,
  deactivate,
  busy,
  programadas = [],
  onSubmit,
  centralizada = false,
  reglaId = null,
}: {
  nombre: string;
  version?: Version | null;
  revision: number;
  editing: boolean;
  readOnly: boolean;
  deactivate: boolean;
  busy: boolean;
  onSubmit: (data: ReglaWrite, destination: SaveDestination) => Promise<void>;
  programadas?: Version[];
  centralizada?: boolean;
  reglaId?: number | null;
}) {
  const prefix = useId();
  const initial = fields(nombre, version);
  if (readOnly) initial.motivo = version?.motivo ?? '';
  if (deactivate) {
    initial.activa = false;
    initial.periodoDesde = '';
    initial.periodoHasta = '';
  }
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<Fields>({
    resolver: zodResolver(reglaSchema),
    defaultValues: initial,
  });
  const array = useFieldArray({ control, name: 'condiciones' });
  const values = watch();
  const [selector, setSelector] = useState(false);
  const [added, setAdded] = useState<Destino[]>([]);
  const destinos = useDestinos(version?.formulas ?? []);
  const labels = new Map(
    [...(destinos.data ?? []), ...added].map((x) => [x.id, x]),
  );
  const disabled = busy || readOnly;
  const issue = (key: keyof Fields) =>
    errors[key]?.message && (
      <p role="alert" className="field-error">
        {String(errors[key]?.message)}
      </p>
    );
  const futuras = programadas.filter(
    (v) =>
      values.periodoDesde &&
      month(v.periodoDesde) > values.periodoDesde &&
      !programadas.some(
        (w) => w.periodoDesde === v.periodoDesde && w.revision > v.revision,
      ),
  );
  return (
    <form
      id={readOnly ? `regla-view-${version?.id ?? 'new'}` : 'regla-form'}
      className="regla-form"
      onSubmit={handleSubmit(async (data, e) => {
        if (disabled) return;
        await onSubmit(
          payload(data, revision),
          getSaveDestination(
            (e?.nativeEvent as SubmitEvent | undefined)?.submitter ?? null,
          ),
        );
      })}
    >
      <p className="regla-hint">
        {readOnly
          ? `Revisión ${version?.revision}. Sólo lectura.`
          : editing
            ? `Guardar publicará una nueva revisión (actual: ${revision}). Las anteriores se conservan.`
            : 'Crearás la regla y su primera versión.'}
      </p>
      {editing && (
        <p className="regla-hint">
          El nombre identifica la regla y no cambia. Corregí el mismo período o
          elegí otro inicio para programar un cambio.
        </p>
      )}
      {deactivate && (
        <p role="note">
          La desactivación sólo rige desde el período indicado. Las
          publicaciones posteriores conservan su vigencia: revisá el historial
          antes de guardar.
        </p>
      )}
      {deactivate && futuras.length > 0 && (
        <div role="note">
          <strong>Publicaciones posteriores que se conservarán:</strong>
          <ul>
            {futuras.map((v) => (
              <li key={v.id}>
                Revisión {v.revision} · Desde {periodoTexto(v.periodoDesde)} ·{' '}
                {v.activa ? 'Activa' : 'Inactiva'}
              </li>
            ))}
          </ul>
        </div>
      )}
      <fieldset disabled={disabled} className="regla-fieldset">
        <legend className="regla-section-title">Datos de la publicación</legend>
        <div className="regla-general">
          <div className="regla-wide">
            <Input
              label="Nombre"
              {...register('nombre')}
              readOnly={editing || readOnly}
              error={errors.nombre?.message}
            />
          </div>
          <Input
            label="Período desde"
            type="month"
            {...register('periodoDesde')}
            error={errors.periodoDesde?.message}
          />
          <Input
            label="Período hasta"
            type="month"
            {...register('periodoHasta')}
            error={errors.periodoHasta?.message}
          />
          <label className="regla-check">
            <input
              type="checkbox"
              {...register('activa')}
              disabled={disabled || deactivate}
            />
            Activa
          </label>
          <div className="field">
            <label htmlFor={`${prefix}-tipo`}>Operación</label>
            <Select id={`${prefix}-tipo`} {...register('tipo')}>
              {Object.entries(operaciones).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            {issue('tipo')}
          </div>
          {!(values.tipo === 'fijarImporteMensual' && values.fuenteMensual) && (
            <Input
              label={
                [
                  'ajusteImporteFijo',
                  'fijarImporte',
                  'fijarImporteMensual',
                ].includes(values.tipo)
                  ? 'Importe ($)'
                  : 'Porcentaje (%)'
              }
              inputMode="decimal"
              {...register('valor')}
              error={errors.valor?.message}
            />
          )}
          {values.tipo === 'fijarImporte' && (
            <p className="regla-hint regla-wide">
              El importe final será el valor indicado, independientemente del
              importe original, la cantidad o el factor de jornada. Publicá una
              nueva revisión para cada cambio de valor y documentá su fuente en
              el motivo. Las condiciones determinan cuándo se aplica.
            </p>
          )}
          {values.tipo === 'fijarImporteMensual' && (
            <label>
              Fuente del objetivo mensual
              <Select
                {...register('fuenteMensual')}
                onChange={(e) => {
                  setValue(
                    'fuenteMensual',
                    e.target.value as Fields['fuenteMensual'],
                  );
                  if (e.target.value) setValue('valor', '0');
                }}
              >
                <option value="">Importe ingresado manualmente</option>
                <option value="SCVO">
                  SCVO · prima oficial y aplicabilidad del legajo
                </option>
                <option value="FFEP">FFEP · cuota oficial vigente</option>
                <option value="ART_FIJO">
                  ART · fijo contractual de la empresa, sin FFEP
                </option>
              </Select>
            </label>
          )}
          {values.tipo === 'fijarImporteMensual' && (
            <p className="regla-hint regla-wide">
              El importe será el objetivo mensual menos lo ya liquidado por esta
              regla en otros recibos de la misma empresa, legajo y período.
              Generá primero la liquidación mensual; las complementarias toman
              la diferencia, que puede ser negativa. Usá una sola regla por
              obligación y una sola fórmula aplicable por recibo (columna 4).
              Documentá la fuente y el personal alcanzado en el motivo.
            </p>
          )}
          {values.tipo === 'fijarAlicuota' && (
            <div className="regla-wide">
              <Input
                label="Expresión de base"
                {...register('expresionBase')}
                error={errors.expresionBase?.message}
              />
              <small>
                El importe final será base × alícuota / 100. La disponibilidad
                de las variables se comprueba al calcular el recibo.
              </small>
            </div>
          )}
          <div className="field regla-wide">
            <label htmlFor={`${prefix}-motivo`}>Motivo</label>
            <textarea
              id={`${prefix}-motivo`}
              rows={2}
              {...register('motivo')}
            />
            {issue('motivo')}
          </div>
        </div>
      </fieldset>
      <section aria-label="Fórmulas destino" className="regla-associations">
        <div className="regla-section-heading">
          <h3>Fórmulas ({values.formulas.length})</h3>
          {!readOnly && (
            <Button
              variant="ghost"
              disabled={busy || values.formulas.length >= 500}
              onClick={() => setSelector(true)}
            >
              Agregar fórmulas
            </Button>
          )}
        </div>
        {issue('formulas')}
        {destinos.isFetching && <p role="status">Cargando descripciones…</p>}
        {destinos.isError && (
          <p role="alert">
            {errorMessage(destinos.error)}{' '}
            <Button variant="ghost" onClick={() => void destinos.refetch()}>
              Reintentar
            </Button>
          </p>
        )}
        {!values.formulas.length && <p>No hay fórmulas seleccionadas.</p>}
        {values.formulas.map((id) => {
          const d = labels.get(id);
          return (
            <div key={id} className="regla-detail">
              <div className="regla-detail-data">
                <span>
                  {d
                    ? `${d.codigo ?? id} · ${d.descripcion ?? 'Sin descripción'}`
                    : `Fórmula ID ${id}`}
                </span>
                <small>
                  {d?.convenioNombre ??
                    (d?.convenioId ? `Convenio ${d.convenioId}` : '')}
                  {d && !d.activo ? ' · Inactiva' : ''}
                </small>
              </div>
              {!readOnly && (
                <div className="regla-actions">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Quitar fórmula ${id}`}
                    onClick={() =>
                      setValue(
                        'formulas',
                        values.formulas.filter((x) => x !== id),
                        { shouldValidate: true, shouldDirty: true },
                      )
                    }
                  >
                    Quitar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </section>
      <section aria-label="Condiciones" className="regla-associations">
        <div className="regla-section-heading">
          <h3>Condiciones ({values.condiciones.length})</h3>
          {!readOnly && (
            <Button
              variant="ghost"
              disabled={busy || values.condiciones.length >= 20}
              onClick={() =>
                array.append(
                  nuevaCondicion('legajo.modalidadContratacionCodigo'),
                )
              }
            >
              Agregar condición
            </Button>
          )}
        </div>
        <p className="regla-hint">
          Todas las condiciones deben cumplirse (Y). Sin condiciones
          adicionales, aplica a los destinos dentro de la vigencia. Un beneficio
          debe habilitarse por separado en el legajo.
        </p>
        {array.fields.map((row, i) => (
          <div key={row.id}>
            <CondicionEditor
              value={values.condiciones[i]!}
              index={i}
              disabled={disabled}
              onChange={(v) =>
                setValue(`condiciones.${i}`, v, { shouldDirty: true })
              }
              onRemove={() => array.remove(i)}
            />
            {errors.condiciones?.[i] && (
              <p role="alert" className="field-error">
                {errors.condiciones[i]?.message ??
                  errors.condiciones[i]?.root?.message ??
                  'Revisá los valores de esta condición.'}
              </p>
            )}
          </div>
        ))}
        {issue('condiciones')}
      </section>
      {readOnly && version && (
        <p className="regla-hint">
          Desde {periodoTexto(month(version.periodoDesde))} · Publicada{' '}
          {new Date(version.creadoEn).toLocaleString('es-AR')} · Usuario{' '}
          {version.creadoPorUserId}
        </p>
      )}
      {selector && (
        <DestinoSelector
          centralizada={centralizada}
          reglaId={reglaId}
          existing={values.formulas}
          onClose={() => setSelector(false)}
          onAdd={(rows) => {
            setAdded((prev) => [...prev, ...rows]);
            setValue(
              'formulas',
              [...new Set([...values.formulas, ...rows.map((x) => x.id)])],
              { shouldDirty: true, shouldValidate: true },
            );
          }}
        />
      )}
    </form>
  );
}
