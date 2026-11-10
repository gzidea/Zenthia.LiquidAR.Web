import { Select } from '@/components/ui/Select';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Brand } from '@/components/Brand';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { reciboDemoService } from './service';
import { demoSchema } from './schema';
import { ReciboHtml } from './ReciboHtml';
import type { DemoInicio, DemoRequest } from './types';
import './recibo-demo.css';

const queryOptions = {
  retry: false,
  refetchOnWindowFocus: false,
  gcTime: 0,
} as const;
function Simulacion({ initial }: { initial: DemoInicio }) {
  const form = useForm<DemoRequest>({
    resolver: zodResolver(demoSchema),
    mode: 'onChange',
    defaultValues: {
      nombre: initial.nombre,
      fechaIngreso: initial.fechaIngreso,
      convenioId: initial.convenios[0]?.id ?? 0,
      categoriaId: 0,
      periodo: initial.periodoInicial,
    },
  });
  const values = useWatch({ control: form.control });
  const convenioId = values.convenioId ?? 0;
  const firstCategory = useRef(true);
  const categorias = useQuery({
    queryKey: ['demo-categorias', convenioId],
    queryFn: ({ signal }) => reciboDemoService.categorias(convenioId, signal),
    enabled: convenioId > 0,
    ...queryOptions,
  });
  useEffect(() => {
    const first = categorias.data?.[0];
    if (firstCategory.current && first) {
      form.setValue('categoriaId', first.id, { shouldValidate: true });
      firstCategory.current = false;
    }
  }, [categorias.data, form]);
  const parsed = demoSchema.safeParse(values);
  const valid =
    parsed.success &&
    values.fechaIngreso! <= initial.fechaReferencia &&
    categorias.data?.some((c) => c.id === values.categoriaId);
  const key = valid ? JSON.stringify(parsed.data) : '';
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(key), 450);
    return () => clearTimeout(timeout);
  }, [key]);
  const calculation = useQuery({
    queryKey: ['demo-calculo', debounced],
    queryFn: ({ signal }) =>
      reciboDemoService.calcular(JSON.parse(debounced) as DemoRequest, signal),
    enabled: Boolean(debounced) && debounced === key,
    ...queryOptions,
  });
  const current = key && key === debounced;
  const errors = form.formState.errors;
  return (
    <div className="demo-workspace">
      <form
        className="demo-editor"
        onSubmit={form.handleSubmit(() => {
          if (current) void calculation.refetch();
          else setDebounced(key);
        })}
      >
        <h2>Datos de la muestra</h2>
        <p className="demo-context">
          Tipo de liquidación: {initial.tipoLiquidacion}
        </p>
        {initial.seguros && (
          <p className="demo-context">
            Seguros de muestra: régimen{' '}
            {initial.seguros.regimen === 'general'
              ? 'General'
              : 'Casas particulares'}
            . SCVO y FFEP usan los valores oficiales vigentes para el período.
          </p>
        )}
        <Input
          label="Apellido y nombre"
          maxLength={120}
          {...form.register('nombre')}
          error={errors.nombre?.message}
        />
        <Input
          label="Fecha de ingreso"
          type="date"
          max={initial.fechaReferencia}
          {...form.register('fechaIngreso')}
          error={
            errors.fechaIngreso?.message ??
            (values.fechaIngreso &&
            values.fechaIngreso > initial.fechaReferencia
              ? 'La fecha no puede ser posterior a la referencia.'
              : undefined)
          }
        />
        <Input
          label="Período de liquidación"
          type="month"
          {...form.register('periodo')}
          error={errors.periodo?.message}
        />
        <div className="field">
          <label htmlFor="demo-convenio">Convenio</label>
          <Select
            id="demo-convenio"
            {...form.register('convenioId', {
              valueAsNumber: true,
              onChange: () => {
                firstCategory.current = false;
                form.setValue('categoriaId', 0);
              },
            })}
          >
            <option value={0}>Seleccioná un convenio</option>
            {initial.convenios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div className="field">
          <label htmlFor="demo-categoria">Categoría</label>
          <Select
            id="demo-categoria"
            disabled={!categorias.data?.length || categorias.isFetching}
            {...form.register('categoriaId', { valueAsNumber: true })}
          >
            <option value={0}>
              {categorias.isPending
                ? 'Cargando categorías…'
                : 'Seleccioná una categoría'}
            </option>
            {categorias.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
        {categorias.isError && (
          <div role="alert">
            <p>No pudimos cargar las categorías.</p>
            <Button variant="ghost" onClick={() => void categorias.refetch()}>
              Reintentar categorías
            </Button>
          </div>
        )}
        {categorias.data?.length === 0 && (
          <p role="status">El convenio no tiene categorías disponibles.</p>
        )}
        <Button type="submit" disabled={!valid} busy={calculation.isFetching}>
          Recalcular recibo
        </Button>
        <p className="demo-context">
          Los cambios válidos recalculan automáticamente. Los conceptos se
          seleccionan según el convenio.
        </p>
        <p className="demo-context">
          Empleado ficticio · Sin guardado
          <br />
          Jornada del escenario: {initial.jornadaHoras}
          <br />
          Antigüedad al {initial.fechaReferencia.split('-').reverse().join('/')}
        </p>
      </form>
      <section className="demo-preview" aria-label="Vista previa">
        <div aria-live="polite" className="demo-preview-status">
          {!valid
            ? 'Completá los datos para calcular el recibo.'
            : !current || calculation.isFetching
              ? 'Actualizando simulación…'
              : calculation.isError
                ? 'No se pudo actualizar la simulación.'
                : null}
        </div>
        {current && calculation.isError ? (
          <div className="demo-empty" role="alert">
            <h2>No pudimos calcular el recibo</h2>
            <p>
              El servicio no está disponible o los datos necesitan revisión.
            </p>
            <Button onClick={() => void calculation.refetch()}>
              Reintentar cálculo
            </Button>
          </div>
        ) : current && calculation.data && !calculation.isFetching ? (
          <ReciboHtml result={calculation.data} />
        ) : (
          <div className="demo-empty" aria-busy={Boolean(valid)}>
            <div className="demo-placeholder-heading" />
            <div className="demo-placeholder-fields" />
            <p>
              {valid
                ? 'Preparando el recibo con las fórmulas del convenio…'
                : 'Seleccioná convenio y categoría para ver la simulación.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
export function ReciboDemoPage() {
  const initial = useQuery({
    queryKey: ['demo-inicio'],
    queryFn: ({ signal }) => reciboDemoService.inicio(signal),
    ...queryOptions,
  });
  useEffect(() => {
    document.title = 'Simulador de recibo | LiquidAR';
  }, []);
  return (
    <div className="recibo-demo">
      <header className="demo-header">
        <Brand />
        <span>DEMOSTRACIÓN PÚBLICA</span>
        <Link to="/login">Ingresar al sistema</Link>
      </header>
      <main id="main-content">
        <h1 tabIndex={-1}>Tu recibo, en una vista</h1>
        <p className="demo-intro">
          Explorá el cálculo de sueldo con convenios y fórmulas del sistema. Los
          datos del empleado son ficticios y no se guardan.
        </p>
        {initial.isPending ? (
          <div className="demo-empty" role="status">
            Cargando los convenios de la muestra…
          </div>
        ) : initial.isError ? (
          <div className="demo-empty" role="alert">
            <h2>La demostración no está disponible</h2>
            <p>
              No pudimos cargar los catálogos. Intentá nuevamente en unos
              momentos.
            </p>
            <Button onClick={() => void initial.refetch()}>Reintentar</Button>
          </div>
        ) : initial.data.convenios.length === 0 ? (
          <div className="demo-empty" role="status">
            No hay convenios disponibles para esta demostración.
          </div>
        ) : (
          <Simulacion initial={initial.data} />
        )}
      </main>
    </div>
  );
}
