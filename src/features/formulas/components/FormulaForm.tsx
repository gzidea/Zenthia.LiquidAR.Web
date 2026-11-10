import { Select } from '@/components/ui/Select';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton, DataGridSkeleton } from '@/components/ui/Skeleton';
import {
  getSaveDestination,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { ApiError } from '@/services/http/ApiError';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { useFormulaCatalog } from '../hooks/useFormulas';
import {
  formulaFields,
  formulaSchema,
  toFormula,
  type FormulaFields,
} from '../schemas/formulaSchema';
import {
  catalogLabel,
  columnaReciboLabel,
  type Catalogo,
  type CatalogKind,
  type FormulaCompleta,
  type FormulaWrite,
  type Periodo,
  type Tipo,
} from '../types/formula';
import { FormulaSelector } from './FormulaSelector';
import { FormulaDetailRow } from './FormulaDetailRow';
const textFields = {
  codigo: 'Código',
  orden: 'Orden',
  codigoAfip: 'Código AFIP',
  descripcion: 'Descripción',
  vigenteDesde: 'Vigente desde',
  vigenteHasta: 'Vigente hasta',
} as const;
const expressions = {
  formulaCantidad: 'Cantidad',
  formulaBase: 'Base',
  formulaImporte: 'Importe',
} as const;
const flags = {
  sumaAlBasico: 'Suma al básico',
  activo: 'Activo',
  visible: 'Visible',
  afectaMejorSueldo: 'Afecta mejor sueldo',
  afectaImpuestoGanancia: 'Afecta Ganancias',
  incluirDescripcionConcepto: 'Incluir descripción del concepto',
  auxiliar: 'Auxiliar',
  informarCantidadLsd: 'Informar cantidad en TXT de Libro de sueldo',
} as const;
export function FormulaFormSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando formulario de fórmula"
      className="formula-form"
    >
      <div className="formula-root" aria-hidden="true">
        {[
          'Convenio',
          'Concepto',
          'Columna del recibo',
          'Código',
          'Orden',
          'Código AFIP',
          'Variable',
          'Suma al básico',
          'Descripción',
          'Unidad',
          'Activo / Visible',
          'Cantidad',
          'Base',
          'Importe',
          'Opciones',
          'Descripción completa',
          'Cargar como novedad',
          'Vigente desde',
          'Vigente hasta',
        ].map((label, i) => (
          <div
            key={label}
            className={`field ${[0, 1, 2, 8, 11, 12, 13, 14, 15].includes(i) ? 'formula-wide' : ''}`}
          >
            <label>{label}</label>
            <Skeleton
              height={
                [11, 12, 13].includes(i)
                  ? '64px'
                  : 'var(--formula-control-height)'
              }
            />
          </div>
        ))}
      </div>
      <DataGridSkeleton columns={3} actions />
    </div>
  );
}
export function FormulaForm({
  initial,
  busy,
  readOnly,
  canDelete,
  error,
  onSubmit,
  catalogos,
  allowClone = true,
}: {
  initial?: FormulaCompleta;
  busy: boolean;
  readOnly: boolean;
  canDelete: boolean;
  error?: unknown;
  catalogos?: Record<CatalogKind, Catalogo[]>;
  allowClone?: boolean;
  onSubmit: (
    data: FormulaWrite,
    destination: SaveDestination,
    clone: boolean,
  ) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormulaFields>({
    resolver: zodResolver(formulaSchema),
    defaultValues: formulaFields(initial?.formula),
  });
  const permissions = usePermissions();
  const permisosCatalogos = (permission: string) =>
    Boolean(catalogos) || permissions.can(permission);
  const consultaConvenios = useFormulaCatalog(
    'convenios',
    !catalogos && permisosCatalogos('convenios:read'),
  );
  const consultaConceptos = useFormulaCatalog(
    'conceptos',
    !catalogos && permisosCatalogos('conceptos:read'),
  );
  const consultaUnidades = useFormulaCatalog(
    'unidades',
    !catalogos && permisosCatalogos('auxiliar:read'),
  );
  const convenios = catalogos
    ? {
        ...consultaConvenios,
        data: catalogos.convenios,
        isFetching: false,
        isError: false,
      }
    : consultaConvenios;
  const conceptos = catalogos
    ? {
        ...consultaConceptos,
        data: catalogos.conceptos,
        isFetching: false,
        isError: false,
      }
    : consultaConceptos;
  const unidades = catalogos
    ? {
        ...consultaUnidades,
        data: catalogos.unidades,
        isFetching: false,
        isError: false,
      }
    : consultaUnidades;
  const [periodos, setPeriodos] = useState<Periodo[]>(initial?.periodos ?? []);
  const [tipos, setTipos] = useState<Tipo[]>(initial?.tiposLiquidacion ?? []);
  const [periodosEliminar, setPeriodosEliminar] = useState<number[]>([]);
  const [tiposEliminar, setTiposEliminar] = useState<number[]>([]);
  const [tab, setTab] = useState<'tipoliquidacion' | 'meses'>(
    'tipoliquidacion',
  );
  const [selector, setSelector] = useState<'tipoliquidacion' | 'meses' | null>(
    null,
  );
  const value = watch();
  const concept = conceptos.data?.find(
    (x) => x.id === Number(value.conceptoId),
  );
  const conceptoNombre = concept
    ? catalogLabel(concept)
    : Number(value.conceptoId) === initial?.formula.conceptoId
      ? (initial.formula.conceptoDescripcion ?? '')
      : '';
  useEffect(() => {
    if (error instanceof ApiError)
      for (const [path, message] of Object.entries(error.fieldErrors ?? {})) {
        const key = path.replace(/^formula\./i, '');
        const normalized = key.charAt(0).toLowerCase() + key.slice(1);
        if (normalized in formulaFields())
          setError(normalized as keyof FormulaFields, { message });
      }
  }, [error, setError]);
  function select(
    name: 'convenioId' | 'conceptoId' | 'unidadId',
    label: string,
    rows: Catalogo[] | undefined,
    allowed: boolean,
    loading: boolean,
    failed: boolean,
    retry: () => void,
    originalLabel: string | null | undefined,
  ) {
    const current = value[name];
    const missing = current && !rows?.some((x) => x.id === Number(current));
    return (
      <div className={`field ${name !== 'unidadId' ? 'formula-wide' : ''}`}>
        <label htmlFor={`formula-${name}`}>{label}</label>
        <div>
          <Select
            id={`formula-${name}`}
            columns={
              name === 'conceptoId'
                ? ['Descripción', 'Columna del recibo']
                : undefined
            }
            {...register(name)}
            value={current ?? ''}
            disabled={readOnly || busy || !allowed || loading || failed}
            aria-invalid={!!errors[name]}
          >
            <option value="">Sin selección</option>
            {missing && (
              <option value={current}>
                {originalLabel ?? `ID ${current}`}
              </option>
            )}
            {rows?.map((x) => (
              <option
                key={x.id}
                value={x.id}
                data-search={x.codigo ?? x.id}
                data-secondary={
                  name === 'conceptoId'
                    ? columnaReciboLabel(x.columnaRecibo)
                    : undefined
                }
              >
                {catalogLabel(x)}
              </option>
            ))}
          </Select>
          {!allowed && <small>Sin permiso para consultar este catálogo.</small>}
          {loading && allowed && <small>Cargando opciones…</small>}
          {failed && allowed && (
            <Button variant="ghost" type="button" onClick={retry}>
              Reintentar {label.toLowerCase()}
            </Button>
          )}
        </div>
        {errors[name] && (
          <span className="field-error">{errors[name]?.message}</span>
        )}
      </div>
    );
  }
  return (
    <>
      <form
        id="formula-form"
        className="formula-form"
        onSubmit={(event) => {
          if (busy || readOnly) {
            event.preventDefault();
            return;
          }
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const clone =
            submitter instanceof HTMLButtonElement &&
            submitter.value === 'clone';
          const destination = getSaveDestination(submitter);
          void handleSubmit((values) => {
            const p = periodos.filter(
              (x) =>
                x.id === null ||
                initial?.periodos.some(
                  (old) =>
                    old.id === x.id && old.seleccionado !== x.seleccionado,
                ),
            );
            const t = tipos.filter(
              (x) =>
                x.id === null ||
                initial?.tiposLiquidacion.some(
                  (old) =>
                    old.id === x.id && old.seleccionado !== x.seleccionado,
                ),
            );
            return onSubmit(
              {
                formula: toFormula(values, initial?.formula),
                periodos: p.map(({ id, numeroMes, seleccionado }) => ({
                  id,
                  numeroMes,
                  seleccionado,
                })),
                tiposLiquidacion: t.map(
                  ({ id, idTipoLiquidacion, seleccionado }) => ({
                    id,
                    idTipoLiquidacion,
                    seleccionado,
                  }),
                ),
                periodosEliminar,
                tiposLiquidacionEliminar: tiposEliminar,
              },
              destination,
              clone,
            );
          })(event);
        }}
      >
        <fieldset className="formula-fieldset" disabled={busy || readOnly}>
          <div className="formula-root">
            {select(
              'convenioId',
              'Convenio',
              convenios.data,
              permisosCatalogos('convenios:read'),
              convenios.isFetching,
              convenios.isError,
              () => void convenios.refetch(),
              initial?.formula.convenioNombre,
            )}
            {select(
              'conceptoId',
              'Concepto',
              conceptos.data,
              permisosCatalogos('conceptos:read'),
              conceptos.isFetching,
              conceptos.isError,
              () => void conceptos.refetch(),
              initial?.formula.conceptoDescripcion,
            )}
            <Input
              className="formula-wide"
              label="Columna del recibo"
              readOnly
              value={
                value.conceptoId
                  ? columnaReciboLabel(concept?.columnaRecibo)
                  : ''
              }
            />
            {(['codigo', 'orden', 'codigoAfip'] as const).map((key) => (
              <Input
                key={key}
                label={textFields[key]}
                {...register(key)}
                error={errors[key]?.message}
                inputMode="numeric"
              />
            ))}
            <Input
              label="Variable"
              readOnly
              value={
                value.convenioId ? `C${value.convenioId}${value.codigo}` : ''
              }
            />
            <div className="formula-flags">
              <label>
                <input type="checkbox" {...register('sumaAlBasico')} />
                Suma al básico
              </label>
            </div>
            <Input
              className="formula-wide"
              label="Descripción"
              {...register('descripcion')}
              error={errors.descripcion?.message}
              maxLength={255}
            />
            {select(
              'unidadId',
              'Unidad',
              unidades.data,
              permisosCatalogos('auxiliar:read'),
              unidades.isFetching,
              unidades.isError,
              () => void unidades.refetch(),
              initial?.formula.unidadDescripcion,
            )}
            <div className="formula-flags">
              {Object.entries(flags)
                .filter(([key]) => key === 'activo' || key === 'visible')
                .map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      {...register(key as keyof typeof flags)}
                    />
                    {label}
                  </label>
                ))}
            </div>
            {Object.entries(expressions).map(([key, label]) => {
              const name = key as keyof typeof expressions;
              const locked =
                name === 'formulaBase'
                  ? value.formulaImporte !== '' || value.formulaCantidad === ''
                  : name === 'formulaImporte'
                    ? value.formulaBase !== ''
                    : false;
              return (
                <div className="field formula-wide" key={key}>
                  <label htmlFor={`formula-${key}`}>{label}</label>
                  <div>
                    <textarea
                      id={`formula-${key}`}
                      rows={2}
                      {...register(name)}
                      readOnly={locked || readOnly}
                      aria-describedby={locked ? `${key}-hint` : undefined}
                    />
                    {locked && (
                      <small id={`${key}-hint`}>
                        {name === 'formulaBase'
                          ? 'Base editable cuando hay Cantidad e Importe está vacío.'
                          : 'Importe editable cuando Base está vacía.'}
                      </small>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="formula-flags formula-wide">
              {Object.entries(flags)
                .filter(
                  ([key]) =>
                    !['activo', 'visible', 'sumaAlBasico'].includes(key),
                )
                .map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      {...register(key as keyof typeof flags)}
                    />
                    {label}
                  </label>
                ))}
            </div>
            <p className="field-note formula-wide">
              Informar cantidad en TXT solo afecta al Libro de sueldo. Al
              desactivarlo, se exportan cantidad cero y unidad en blanco; el
              recibo conserva su cantidad e importe. Los conceptos que requieren
              cantidad no permiten omitirla.
            </p>
            <Input
              className="formula-wide"
              label="Descripción completa"
              readOnly
              value={
                value.incluirDescripcionConcepto
                  ? `${conceptoNombre} ${value.descripcion}`
                  : value.descripcion
              }
            />
            <div className="field">
              <label htmlFor="formula-novedad">Cargar como novedad</label>
              <Select id="formula-novedad" {...register('cargarComoNovedad')}>
                <option value="">Sin definir</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </Select>
            </div>
            {(['vigenteDesde', 'vigenteHasta'] as const).map((key) => (
              <Input
                key={key}
                label={textFields[key]}
                type="date"
                {...register(key)}
              />
            ))}
          </div>
        </fieldset>
        <div
          className="formula-tabs"
          role="tablist"
          aria-label="Aplicación de la fórmula"
        >
          {(['tipoliquidacion', 'meses'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              id={`tab-${kind}`}
              aria-controls={`panel-${kind}`}
              aria-selected={tab === kind}
              tabIndex={tab === kind ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 'tipoliquidacion'
                      : event.key === 'End'
                        ? 'meses'
                        : tab === 'meses'
                          ? 'tipoliquidacion'
                          : 'meses';
                  setTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
              onClick={() => setTab(kind)}
            >
              {kind === 'meses'
                ? `Períodos (${periodos.length})`
                : `Tipos de liquidación (${tipos.length})`}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="formula-associations"
        >
          {!readOnly && (
            <Button
              variant="ghost"
              type="button"
              disabled={busy || !permisosCatalogos('auxiliar:read')}
              onClick={() => setSelector(tab)}
            >
              Agregar {tab === 'meses' ? 'períodos' : 'tipos de liquidación'}
            </Button>
          )}
          {!permisosCatalogos('auxiliar:read') && !readOnly && (
            <p>Sin permiso para agregar opciones del catálogo auxiliar.</p>
          )}
          <p className="formula-hint">
            Los períodos son meses del año. Para calcular, la fórmula debe tener
            Aplicar marcado en el mes y en el tipo de liquidación
            correspondientes.
          </p>
          {(tab === 'meses' ? periodos : tipos).length === 0 && (
            <p>
              No hay {tab === 'meses' ? 'períodos' : 'tipos de liquidación'}{' '}
              asociados.
            </p>
          )}
          {tab === 'meses'
            ? periodos.map((row, index) => (
                <FormulaDetailRow
                  key={row.id ?? `new-${index}`}
                  label={`Período ${index + 1}`}
                  description={`${row.numeroMes ?? 'Sin referencia'} · ${row.mesNombre ?? 'Sin nombre'}`}
                  selected={row.seleccionado}
                  busy={busy}
                  readOnly={readOnly}
                  canRemove={row.id === null || canDelete}
                  removeLabel="Quitar período"
                  onSelected={(selected) =>
                    setPeriodos((rows) =>
                      rows.map((r, i) =>
                        i === index ? { ...r, seleccionado: selected } : r,
                      ),
                    )
                  }
                  onRemove={() => {
                    setPeriodos((rows) => rows.filter((_, i) => i !== index));
                    if (row.id !== null)
                      setPeriodosEliminar((ids) => [...ids, row.id!]);
                  }}
                />
              ))
            : tipos.map((row, index) => (
                <FormulaDetailRow
                  key={row.id ?? `new-${index}`}
                  label={`Tipo de liquidación ${index + 1}`}
                  description={`${row.idTipoLiquidacion ?? 'Sin referencia'} · ${row.tipoLiquidacionDescripcion ?? 'Sin descripción'}`}
                  selected={row.seleccionado}
                  busy={busy}
                  readOnly={readOnly}
                  canRemove={row.id === null || canDelete}
                  removeLabel="Quitar tipo"
                  onSelected={(selected) =>
                    setTipos((rows) =>
                      rows.map((r, i) =>
                        i === index ? { ...r, seleccionado: selected } : r,
                      ),
                    )
                  }
                  onRemove={() => {
                    setTipos((rows) => rows.filter((_, i) => i !== index));
                    if (row.id !== null)
                      setTiposEliminar((ids) => [...ids, row.id!]);
                  }}
                />
              ))}
        </div>
        {!readOnly && initial && allowClone && (
          <div className="formula-clone">
            <p>
              Guardar y clonar copia las asociaciones y omite la expresión Base
              en la copia, como en la aplicación anterior.
            </p>
            <Button variant="ghost" type="submit" value="clone" disabled={busy}>
              Guardar y clonar
            </Button>
          </div>
        )}
      </form>
      {selector && (
        <FormulaSelector
          kind={selector}
          options={catalogos?.[selector]}
          existing={
            selector === 'meses'
              ? periodos.map((x) => x.numeroMes)
              : tipos.map((x) => x.idTipoLiquidacion)
          }
          onClose={() => setSelector(null)}
          onAdd={(rows) =>
            selector === 'meses'
              ? setPeriodos((current) => [
                  ...current,
                  ...rows.map((x) => ({
                    id: null,
                    numeroMes: x.id,
                    mesNombre: catalogLabel(x),
                    seleccionado: true,
                  })),
                ])
              : setTipos((current) => [
                  ...current,
                  ...rows.map((x) => ({
                    id: null,
                    idTipoLiquidacion: x.id,
                    tipoLiquidacionDescripcion: catalogLabel(x),
                    seleccionado: true,
                  })),
                ])
          }
        />
      )}
    </>
  );
}
