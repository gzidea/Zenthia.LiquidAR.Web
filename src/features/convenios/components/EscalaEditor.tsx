import { Select } from '@/components/ui/Select';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/services/http/ApiError';
import { useConvenioDetail, useEscalasMutations } from '../hooks/useConvenios';
import {
  month,
  monthInput,
  money,
  percentage,
  periodo,
  nullable,
} from '../schemas/convenioSchema';
import type {
  ImportesRequest,
  CategoriaResumen,
  VersionImporte,
} from '../types/convenio';
const schema = z
  .object({
    mes: month,
    modo: z.enum(['final', 'porcentaje']),
    motivo: z.string().trim().min(1, 'Ingresá un motivo.').max(1000),
    importe: z.string(),
    adicional1: z.string(),
    adicional2: z.string(),
  })
  .superRefine((v, ctx) => {
    const validator = v.modo === 'final' ? money : percentage;
    for (const key of ['importe', 'adicional1', 'adicional2'] as const) {
      const valid = validator.safeParse(v[key]);
      if (!valid.success)
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: valid.error.issues[0]?.message ?? 'Importe inválido.',
        });
    }
    if (v.modo === 'porcentaje' && !v.importe && !v.adicional1 && !v.adicional2)
      ctx.addIssue({
        code: 'custom',
        path: ['importe'],
        message: 'Ingresá al menos un porcentaje.',
      });
  });
type Fields = z.infer<typeof schema>;
export function nextMonth(operative: string) {
  const year = Number(operative.slice(2));
  const m = Number(operative.slice(0, 2));
  return `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
}
export function scaleRequest(
  v: Fields,
  rows: CategoriaResumen[],
): ImportesRequest {
  return {
    categorias: rows.map((r) => ({
      idCategoria: r.categoria.id,
      propuesta: {
        periodoDesde: periodo(v.mes),
        modo: v.modo,
        revisionEsperada: r.revisionPeriodo,
        motivo: v.motivo,
        ...(v.modo === 'final'
          ? {
              importe: nullable(v.importe),
              adicional1: nullable(v.adicional1),
              adicional2: nullable(v.adicional2),
            }
          : {
              idVersionBase: r.versionBase?.id ?? 0,
              porcentajeImporte: nullable(v.importe),
              porcentajeAdicional1: nullable(v.adicional1),
              porcentajeAdicional2: nullable(v.adicional2),
            }),
      },
    })),
  };
}
export function EscalaEditor({
  id,
  ids,
  operativo,
  initialMes,
  initialVersion,
  onClose,
}: {
  id: number;
  ids: number[];
  operativo: string;
  initialMes?: string;
  initialVersion?: VersionImporte;
  onClose: () => void;
}) {
  const form = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      mes: initialMes ?? nextMonth(operativo),
      modo: ids.length > 1 ? 'porcentaje' : 'final',
      motivo: '',
      importe: initialVersion?.importe ?? '',
      adicional1: initialVersion?.adicional1 ?? '',
      adicional2: initialVersion?.adicional2 ?? '',
    },
  });
  const values = form.watch();
  const validMonth = month.safeParse(values.mes).success;
  const query = useConvenioDetail(
    id,
    validMonth,
    validMonth ? periodo(values.mes) : undefined,
  );
  const { preview, publish } = useEscalasMutations(id);
  const [snapshot, setSnapshot] = useState<{
    signature: string;
    request: ImportesRequest;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const rows =
    query.data?.categorias.filter((r) => ids.includes(r.categoria.id)) ?? [];
  const signature = JSON.stringify({ ...values, motivo: values.motivo.trim() });
  const currentPreview = !!snapshot && snapshot.signature === signature;
  const busy = preview.isPending || publish.isPending;
  const deps =
    preview.data?.categorias.flatMap((r) => r.versionesDependientes) ?? [];
  const ready =
    validMonth &&
    !query.isFetching &&
    !query.isError &&
    rows.length === ids.length;
  const field = (
    key: 'importe' | 'adicional1' | 'adicional2',
    label: string,
  ) => (
    <Input
      key={key}
      label={values.modo === 'porcentaje' ? `${label} (%)` : label}
      inputMode="decimal"
      {...form.register(key)}
      error={form.formState.errors[key]?.message}
    />
  );
  return (
    <Modal
      open
      size="large"
      title={
        initialVersion
          ? 'Corregir escala inicial'
          : ids.length > 1
            ? 'Ajustar categorías seleccionadas'
            : 'Programar o revisar escala'
      }
      onClose={onClose}
      closeDisabled={busy}
      acceptButton={{
        label: initialVersion ? 'Publicar corrección' : 'Publicar escala',
        disabled: busy || !currentPreview || (deps.length > 0 && !confirmed),
        loading: publish.isPending,
      }}
      cancelButton={{ disabled: busy }}
      onAccept={async () => {
        if (
          !snapshot ||
          !currentPreview ||
          busy ||
          (deps.length > 0 && !confirmed)
        )
          return;
        try {
          await publish.mutateAsync({
            categorias: snapshot.request.categorias.map((r) => ({
              ...r,
              propuesta: { ...r.propuesta, confirmarDependencias: confirmed },
            })),
          });
          onClose();
        } catch {
          setSnapshot(null);
          setConfirmed(false);
          void query.refetch();
        }
      }}
    >
      <form
        className="convenio-form convenio-fields"
        noValidate
        onSubmit={form.handleSubmit(async (v) => {
          if (!ready || busy) return;
          setSnapshot(null);
          setConfirmed(false);
          publish.reset();
          const request = scaleRequest(v, rows);
          if (initialVersion)
            request.categorias = request.categorias.map((r) => ({
              ...r,
              propuesta: {
                ...r.propuesta,
                corregirInicial: true,
                revisionEsperada: initialVersion.revision,
              },
            }));
          try {
            await preview.mutateAsync(request);
            setSnapshot({ signature: JSON.stringify(v), request });
          } catch {
            /* Backend explains the rule. */
          }
        })}
      >
        <fieldset className="convenio-fieldset convenio-fields" disabled={busy}>
          <Input
            label="Desde"
            type="month"
            disabled={!!initialVersion}
            {...form.register('mes')}
            error={form.formState.errors.mes?.message}
          />
          <div className="field">
            <label htmlFor="escala-modo">Modo</label>
            <Select
              disabled={!!initialVersion}
              id="escala-modo"
              {...form.register('modo')}
            >
              <option value="final">Importes finales</option>
              <option value="porcentaje">Ajuste porcentual</option>
            </Select>
          </div>
          {field('importe', 'Importe')}
          {field('adicional1', 'Adicional 1')}
          {field('adicional2', 'Adicional 2')}
          <Input
            label="Motivo"
            {...form.register('motivo')}
            error={form.formState.errors.motivo?.message}
          />
          <p className="field-note">
            {values.modo === 'final'
              ? 'Los importes indicados se aplicarán a cada categoría seleccionada. Un campo vacío representa un valor no cargado.'
              : 'Un porcentaje vacío conserva el importe base. Un 0% es un ajuste explícito sin variación.'}{' '}
            {initialVersion
              ? 'Se creará una nueva revisión del mismo período. La versión original se conserva; los recibos guardados y los importes futuros no se recalculan. La corrección se usará en nuevos cálculos para los períodos cubiertos por esta escala.'
              : `Después de la carga inicial sólo se admiten meses posteriores a ${monthInput(operativo)}.`}
          </p>
        </fieldset>
        {query.isError && (
          <>
            <Notice>{errorMessage(query.error)}</Notice>
            <Button type="button" onClick={() => void query.refetch()}>
              Reintentar escalas
            </Button>
          </>
        )}
        <Button
          type="submit"
          disabled={!ready || busy}
          aria-busy={preview.isPending}
        >
          Previsualizar
        </Button>
      </form>
      {(preview.error || publish.error) && (
        <Notice>{errorMessage(publish.error ?? preview.error)}</Notice>
      )}
      {currentPreview && preview.data && (
        <div className="convenio-preview">
          <table>
            <caption>Previsualización — todavía sin guardar</caption>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Base / revisión</th>
                <th>Importe anterior → nuevo</th>
                <th>Adicional 1 anterior → nuevo</th>
                <th>Adicional 2 anterior → nuevo</th>
              </tr>
            </thead>
            <tbody>
              {preview.data.categorias.map((p) => {
                const row = rows.find(
                  (r) => r.categoria.id === p.version.idCategoria,
                );
                return (
                  <tr key={p.version.idCategoria}>
                    <td>
                      {row?.categoria.descripcion ?? p.version.idCategoria}
                    </td>
                    <td>
                      {p.version.idVersionBase ?? 'Final'} /{' '}
                      {p.version.revision}
                    </td>
                    <td>
                      {(initialVersion
                        ? initialVersion.importe
                        : row?.versionBase?.importe) ?? 'Sin importe'}{' '}
                      → {p.version.importe ?? 'Sin importe'}
                    </td>
                    <td>
                      {(initialVersion
                        ? initialVersion.adicional1
                        : row?.versionBase?.adicional1) ?? 'Sin importe'}{' '}
                      → {p.version.adicional1 ?? 'Sin importe'}
                    </td>
                    <td>
                      {(initialVersion
                        ? initialVersion.adicional2
                        : row?.versionBase?.adicional2) ?? 'Sin importe'}{' '}
                      → {p.version.adicional2 ?? 'Sin importe'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {deps.length > 0 && (
            <>
              <p>
                Versiones dependientes: {deps.join(', ')}. No se recalculan
                automáticamente.
              </p>
              <label className="convenio-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Confirmo conservar los importes de las escalas dependientes.
              </label>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
