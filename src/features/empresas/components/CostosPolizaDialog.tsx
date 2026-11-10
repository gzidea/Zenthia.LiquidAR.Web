import { useState, useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { errorMessage } from '@/services/http/ApiError';
import { useCostosPoliza } from '../hooks/useCostosPoliza';
import {
  costoPolizaSchema,
  type CostoPolizaFields,
} from '../types/costoPoliza';
import type { Empresa } from '../types/empresa';

const tipos = {
  emisionSCVO: 'Emisión SCVO',
  renovacionSCVO: 'Renovación SCVO',
};
export function CostosPolizaDialog({
  empresa,
  canWrite,
  onClose,
}: {
  empresa: Empresa;
  canWrite: boolean;
  onClose: () => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const periodo = month.slice(5, 7) + month.slice(0, 4);
  const { query, publicar } = useCostosPoliza(empresa.id, periodo);
  const formId = useId();
  const [feedback, setFeedback] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CostoPolizaFields>({
    resolver: zodResolver(costoPolizaSchema),
    defaultValues: { poliza: '', tipo: 'emisionSCVO', importe: '', motivo: '' },
  });
  const values = watch();
  const revision = Math.max(
    0,
    ...(query.data?.historial ?? [])
      .filter(
        (x) => x.poliza === values.poliza.trim() && x.tipo === values.tipo,
      )
      .map((x) => x.revision),
  );
  return (
    <Modal
      open
      title={`Emisión y renovación SCVO · ${empresa.nombre ?? empresa.id}`}
      size="large"
      onClose={onClose}
      closeDisabled={publicar.isPending}
      cancelButton={{ label: canWrite ? 'Cancelar' : 'Cerrar' }}
      acceptButton={
        canWrite
          ? {
              label: 'Publicar cargo',
              type: 'submit',
              form: formId,
              disabled: !query.data || query.isFetching || publicar.isPending,
              loading: publicar.isPending,
            }
          : false
      }
    >
      <p>
        Emisión y renovación SCVO se registran una vez por póliza y período como
        costo de empresa. Se conservan las revisiones y no se distribuyen entre
        empleados.
      </p>
      <div className="poliza-period">
        <Input
          label="Período del cargo"
          type="month"
          value={month}
          disabled={publicar.isPending}
          onChange={(e) => {
            setMonth(e.target.value);
            setFeedback('');
            publicar.reset();
          }}
        />
      </div>
      {query.isPending && (
        <div role="status" aria-label="Cargando costos de póliza">
          <Skeleton height="100px" />
        </div>
      )}
      {query.isError && (
        <p role="alert">
          {errorMessage(query.error)}{' '}
          <Button onClick={() => void query.refetch()}>Reintentar</Button>
        </p>
      )}
      {query.data && (
        <>
          <p role="status">
            Total de la empresa en este período: ${query.data.totalEmpresa}.
            Solo se suma la última revisión de cada cargo.
          </p>
          {query.data.historial.length === 0 ? (
            <p>No hay cargos de póliza para este período.</p>
          ) : (
            <div
              className="poliza-history-scroll"
              tabIndex={0}
              role="region"
              aria-label="Historial de cargos, desplazamiento horizontal"
            >
              <table className="poliza-history">
                <caption>Historial de cargos de póliza</caption>
                <thead>
                  <tr>
                    <th>Póliza</th>
                    <th>Tipo</th>
                    <th>Revisión</th>
                    <th>Importe</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.historial.map((row) => (
                    <tr key={row.id}>
                      <td>{row.poliza}</td>
                      <td>{tipos[row.tipo]}</td>
                      <td>{row.revision}</td>
                      <td>
                        ${row.importe}
                        {row.cantidadAsegurados != null && (
                          <>
                            <br />
                            <small>
                              {row.cantidadAsegurados} asegurados · escala #
                              {row.seguroParametroId}
                            </small>
                          </>
                        )}
                      </td>
                      <td>{row.motivo}</td>
                      <td>{row.creadoPorUserId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {canWrite && (
        <form
          id={formId}
          onSubmit={handleSubmit(async (data) => {
            if (publicar.isPending || !query.data || query.isFetching) return;
            try {
              await publicar.mutateAsync({
                ...data,
                periodo,
                revisionEsperada: revision,
              });
              setFeedback(
                'Cargo publicado. El historial conserva las revisiones anteriores.',
              );
              setValue('motivo', '');
            } catch {
              /* Mutation error is presented without discarding the draft. */
            }
          })}
        >
          <fieldset
            disabled={publicar.isPending || !query.data || query.isError}
            className="poliza-fields"
          >
            <legend>Publicar nueva revisión</legend>
            <Input
              label="Póliza SCVO"
              {...register('poliza')}
              error={errors.poliza?.message}
            />
            <div className="field">
              <label htmlFor={`${formId}-tipo`}>Tipo de cargo</label>
              <Select
                id={`${formId}-tipo`}
                {...register('tipo')}
                value={values.tipo}
              >
                <option value="emisionSCVO">Emisión SCVO</option>
                <option value="renovacionSCVO">Renovación SCVO</option>
              </Select>
            </div>
            <Input
              label="Importe del cargo ($)"
              inputMode="decimal"
              {...register('importe')}
              error={errors.importe?.message}
            />
            <Input
              label="Motivo y fuente"
              {...register('motivo')}
              error={errors.motivo?.message}
            />
            <p>
              Revisión actual: {revision}. Para anular el cargo, publicá importe
              0 con el motivo correspondiente.
            </p>
          </fieldset>
        </form>
      )}
      {publicar.isError && (
        <p role="alert">
          {errorMessage(publicar.error)}{' '}
          <Button
            disabled={publicar.isPending}
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
