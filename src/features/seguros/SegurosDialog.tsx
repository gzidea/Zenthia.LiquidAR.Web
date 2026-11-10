import { useSeguros } from './hooks';
import { useEffect, useId, useState } from 'react';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { errorMessage } from '@/services/http/ApiError';
import './seguros.css';
import type { Row } from './service';

const money = z
  .string()
  .regex(
    /^\d{1,15}(\.\d{1,4})?$/,
    'Usá hasta cuatro decimales con punto decimal.',
  );
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Indicá un mes válido.');
export const segurosSchema = z
  .object({
    desde: month,
    hasta: z.union([month, z.literal('')]),
    motivo: z.string().trim().min(1, 'Indicá el motivo.').max(1000),
    codigo: z.enum([
      'SCVO_PRIMA',
      'SCVO_EMISION_25',
      'SCVO_EMISION_50',
      'SCVO_EMISION_MAS',
      'FFEP_CUOTA',
    ]),
    regimen: z.enum(['general', 'casasParticulares']),
    valor: z.union([money, z.literal('')]),
    fuente: z.string().max(1000),
    aseguradoraScvo: z.string().max(150),
    polizaScvo: z.string().max(100),
    aseguradoraArt: z.string().max(150),
    contratoArt: z.string().max(100),
    alicuotaArt: z
      .union([money, z.literal('')])
      .refine(
        (x) => x === '' || Number(x) <= 100,
        'La alícuota no puede superar 100%.',
      ),
    fijoArt: z.union([money, z.literal('')]),
    estado: z.enum(['pendiente', 'corresponde', 'noCorresponde']),
  })
  .refine((x) => !x.hasta || x.hasta >= x.desde, {
    path: ['hasta'],
    message: 'Hasta no puede ser anterior a Desde.',
  });
type Fields = z.infer<typeof segurosSchema>;
export const codigos = {
  SCVO_PRIMA: 'Prima mensual SCVO por persona',
  SCVO_EMISION_25: 'Derecho anual SCVO · hasta 25 asegurados',
  SCVO_EMISION_50: 'Derecho anual SCVO · 26 a 50 asegurados',
  SCVO_EMISION_MAS: 'Derecho anual SCVO · más de 50 asegurados',
  FFEP_CUOTA: 'Cuota FFEP por persona',
};
const estados = {
  pendiente: 'Pendiente de revisión',
  corresponde: 'Corresponde',
  noCorresponde: 'No corresponde',
};
const period = (m: string) => m.slice(5, 7) + m.slice(0, 4);
const defaults = (): Fields => ({
  desde: new Date().toISOString().slice(0, 7),
  hasta: '',
  motivo: '',
  codigo: 'SCVO_PRIMA',
  regimen: 'general',
  valor: '',
  fuente: '',
  aseguradoraScvo: '',
  polizaScvo: '',
  aseguradoraArt: '',
  contratoArt: '',
  alicuotaArt: '',
  fijoArt: '',
  estado: 'pendiente',
});

export function SegurosDialog({
  kind,
  id,
  nombre,
  canWrite,
  onClose,
  formOnly = false,
  initial,
  onPublished,
  bindEmpresaContext = false,
}: {
  kind: 'oficial' | 'empresa' | 'legajo';
  id?: number;
  nombre?: string;
  canWrite: boolean;
  onClose: () => void;
  formOnly?: boolean;
  initial?: Row;
  onPublished?: () => void;
  bindEmpresaContext?: boolean;
}) {
  const { query, mutation } = useSeguros(kind, id);
  const formId = useId();
  const [feedback, setFeedback] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Fields>({
    resolver: zodResolver(segurosSchema),
    defaultValues: initial
      ? {
          ...defaults(),
          codigo: (initial.codigo ?? 'SCVO_PRIMA') as Fields['codigo'],
          regimen: initial.regimen as Fields['regimen'],
          valor: initial.valor ?? '',
          fuente: initial.fuente ?? '',
          aseguradoraScvo: initial.aseguradoraScvo ?? '',
          polizaScvo: initial.polizaScvo ?? '',
          aseguradoraArt: initial.aseguradoraArt ?? '',
          contratoArt: initial.contratoArt ?? '',
          alicuotaArt: initial.alicuotaArt ?? '',
          fijoArt: initial.fijoArt ?? '',
          desde: initial.version.desde.slice(0, 7),
          hasta: initial.version.hasta?.slice(0, 7) ?? '',
        }
      : defaults(),
  });
  const values = watch();
  const busy = mutation.isPending;
  useEffect(() => {
    if (!bindEmpresaContext) return;
    useEmpresaContextStore.getState().bloquearSeleccion(busy);
    return () => useEmpresaContextStore.getState().bloquearSeleccion(false);
  }, [busy, bindEmpresaContext]);
  const rows = query.data ?? [];
  const revision = Math.max(
    0,
    ...rows
      .filter(
        (r) =>
          kind !== 'oficial' ||
          (r.codigo === values.codigo && r.regimen === values.regimen),
      )
      .map((r) => r.version.revision),
  );
  const submit = handleSubmit((v) => {
    if (
      bindEmpresaContext &&
      useEmpresaContextStore.getState().empresaSeleccionadaId !== id
    ) {
      setFeedback(
        'La empresa seleccionada cambió. Abrí una nueva revisión para la empresa actual.',
      );
      return;
    }
    if (!canWrite || busy || query.isFetching || !query.data) return;
    if (kind === 'oficial' && (!v.valor || !v.fuente.trim())) {
      if (!v.valor)
        setError('valor', { message: 'Indicá el importe oficial.' });
      if (!v.fuente.trim())
        setError('fuente', {
          message: 'Indicá la publicación o norma de origen.',
        });
      return;
    }
    if (
      kind === 'empresa' &&
      (v.alicuotaArt !== '' || v.fijoArt !== '') &&
      (!v.aseguradoraArt.trim() || !v.contratoArt.trim())
    ) {
      setError('contratoArt', {
        message:
          'Indicá aseguradora y contrato para configurar los componentes ART.',
      });
      return;
    }
    const vigencia = {
      periodoDesde: period(v.desde),
      periodoHasta: v.hasta ? period(v.hasta) : null,
      motivo: v.motivo,
      revisionEsperada: revision,
    };
    const body =
      kind === 'oficial'
        ? {
            codigo: v.codigo,
            regimen: v.regimen,
            valor: v.valor,
            fuente: v.fuente.trim(),
            vigencia,
          }
        : kind === 'legajo'
          ? { estado: v.estado, vigencia }
          : {
              regimen: v.regimen,
              aseguradoraScvo: v.aseguradoraScvo,
              polizaScvo: v.polizaScvo,
              aseguradoraArt: v.aseguradoraArt,
              contratoArt: v.contratoArt,
              alicuotaArt: v.alicuotaArt || null,
              fijoArt: v.fijoArt || null,
              vigencia,
            };
    setFeedback('');
    mutation.mutate(body, {
      onSuccess: () => {
        setFeedback(
          'Nueva revisión publicada. Los recibos guardados conservan sus valores hasta una adopción explícita.',
        );
        onPublished?.();
      },
    });
  });
  const field = (name: keyof Fields, label: string, type = 'text') => (
    <Input
      label={label}
      type={type}
      {...register(name)}
      error={errors[name]?.message}
    />
  );
  return (
    <Modal
      open
      size="large"
      title={
        kind === 'oficial'
          ? formOnly
            ? 'Nueva revisión · SCVO y FFEP'
            : 'Valores oficiales · SCVO y FFEP'
          : `Seguros · ${nombre ?? id}`
      }
      onClose={onClose}
      closeDisabled={busy}
      cancelButton={{ label: canWrite ? 'Cancelar' : 'Cerrar' }}
      acceptButton={
        canWrite
          ? {
              label: 'Publicar revisión',
              type: 'submit',
              form: formId,
              disabled: !query.data || query.isFetching,
              loading: busy,
            }
          : false
      }
    >
      <p>
        {kind === 'oficial'
          ? 'Valores compartidos por todos los clientes. Cargá la fuente oficial y el período de vigencia; no se actualizan automáticamente.'
          : kind === 'empresa'
            ? 'La alícuota y el fijo ART provienen del contrato. El fijo no incluye FFEP. La prima SCVO y el FFEP se obtienen de los valores oficiales.'
            : 'Revisá exclusiones y pluriempleo antes de indicar la cobertura. Documentá el motivo. Pendiente de revisión bloquea el cálculo y la generación del Libro de Sueldos.'}
      </p>
      {query.isPending && (
        <div role="status" aria-label="Cargando seguros">
          <Skeleton height="120px" />
        </div>
      )}
      {query.isError && (
        <p role="alert">
          {errorMessage(query.error)}{' '}
          <Button variant="ghost" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </p>
      )}
      {query.data && (
        <>
          {!formOnly && (
            <div className="seguros-history">
              <table>
                <caption>Historial de revisiones</caption>
                <thead>
                  <tr>
                    <th>Desde / hasta</th>
                    <th>Configuración</th>
                    <th>Revisión</th>
                    <th>Motivo / fuente</th>
                    {canWrite && <th>Acción</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={canWrite ? 5 : 4}>
                        No hay configuración publicada.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.version.id}>
                      <td>
                        {r.version.desde.slice(0, 7)} /{' '}
                        {r.version.hasta?.slice(0, 7) ?? 'Sin límite'}
                      </td>
                      <td>
                        {kind === 'oficial' ? (
                          `${codigos[r.codigo as keyof typeof codigos]} · ${r.regimen} · $${r.valor}`
                        ) : kind === 'legajo' ? (
                          estados[r.estado as keyof typeof estados]
                        ) : (
                          <>
                            {r.regimen}
                            <br />
                            SCVO: {r.aseguradoraScvo} · {r.polizaScvo}
                            <br />
                            ART: {r.aseguradoraArt} · {r.contratoArt}
                            <br />
                            Alícuota: {r.alicuotaArt ?? 'Sin definir'}% · Fijo:
                            ${r.fijoArt ?? 'Sin definir'}
                          </>
                        )}
                      </td>
                      <td>{r.version.revision}</td>
                      <td>
                        {r.version.motivo}
                        {r.fuente && (
                          <>
                            <br />
                            {r.fuente}
                          </>
                        )}
                      </td>
                      {canWrite && (
                        <td>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              reset({
                                ...defaults(),
                                ...Object.fromEntries(
                                  Object.entries(r).filter(
                                    ([k, v]) => k !== 'version' && v !== null,
                                  ),
                                ),
                                desde: r.version.desde.slice(0, 7),
                                hasta: r.version.hasta?.slice(0, 7) ?? '',
                                motivo: '',
                              } as Fields);
                              mutation.reset();
                            }}
                          >
                            Copiar
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canWrite && (
            <form id={formId} onSubmit={(e) => void submit(e)}>
              <fieldset disabled={busy} className="seguros-form">
                <legend>Nueva revisión</legend>
                {kind === 'oficial' && (
                  <>
                    <label>
                      Parámetro
                      <Select
                        {...register('codigo')}
                        onChange={(e) => {
                          setValue(
                            'codigo',
                            e.target.value as Fields['codigo'],
                          );
                          if (e.target.value !== 'FFEP_CUOTA')
                            setValue('regimen', 'general');
                        }}
                      >
                        {Object.entries(codigos).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    {field('valor', 'Importe oficial ($)')}
                    {field('fuente', 'Fuente normativa')}
                  </>
                )}
                {kind !== 'legajo' && (
                  <label>
                    Régimen
                    <Select
                      {...register('regimen')}
                      disabled={
                        kind === 'oficial' && values.codigo !== 'FFEP_CUOTA'
                      }
                    >
                      <option value="general">General</option>
                      <option value="casasParticulares">
                        Casas particulares
                      </option>
                    </Select>
                  </label>
                )}
                {kind === 'empresa' && (
                  <>
                    {field('aseguradoraScvo', 'Aseguradora SCVO')}
                    {field('polizaScvo', 'Póliza SCVO')}
                    {field('aseguradoraArt', 'Aseguradora ART')}
                    {field('contratoArt', 'Contrato ART')}
                    {field('alicuotaArt', 'Alícuota ART (%)')}
                    {field('fijoArt', 'Fijo ART por trabajador ($, sin FFEP)')}
                    <p>
                      Dejá en blanco los componentes sin definir. Ingresá cero
                      cuando el contrato confirme que no existe cargo fijo. Para
                      casas particulares, configurá fórmulas específicas del
                      régimen.
                    </p>
                  </>
                )}
                {kind === 'legajo' && (
                  <label>
                    Aplicabilidad SCVO
                    <Select {...register('estado')}>
                      {Object.entries(estados).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </label>
                )}
                {field('desde', 'Período desde', 'month')}
                {field('hasta', 'Período hasta (opcional)', 'month')}
                {field('motivo', 'Motivo de la publicación')}
              </fieldset>
            </form>
          )}
        </>
      )}
      {mutation.isError && (
        <p role="alert">
          {errorMessage(mutation.error)} Actualizá el historial si otra persona
          publicó cambios.{' '}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void query.refetch()}
          >
            Actualizar historial
          </Button>
        </p>
      )}
      {feedback && <p role="status">{feedback}</p>}
    </Modal>
  );
}
