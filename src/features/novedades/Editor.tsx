import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import {
  FormDialogActions,
  getSaveDestination,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { fieldsSchema } from './schema';
import type { Draft } from './types';
export function NovedadEditor({
  initial,
  busy,
  readOnly,
  onClose,
  onSave,
  correction = false,
}: {
  initial: Draft;
  busy: boolean;
  readOnly: boolean;
  onClose: () => void;
  onSave: (d: Draft, dest: SaveDestination) => Promise<void>;
  correction?: boolean;
}) {
  const [details, setDetails] = useState(initial.detalles);
  const [quitar, setQuitar] = useState(initial.quitarFormulas);
  const [error, setError] = useState('');
  const form = useForm({
    resolver: zodResolver(fieldsSchema),
    defaultValues: {
      fechaPago: initial.fechaPago,
      diasTrabajados: initial.diasTrabajados,
      horasTrabajadas: initial.horasTrabajadas,
      diasVacaciones: initial.diasVacaciones,
    },
  });
  const submit = (dest: SaveDestination) =>
    form.handleSubmit(async (fields) => {
      try {
        setError('');
        await onSave(
          { ...initial, ...fields, detalles: details, quitarFormulas: quitar },
          dest,
        );
      } catch {
        setError(
          'No se guardó. Revisá los datos y el resultado de la operación.',
        );
      }
    })();
  return (
    <Modal
      open
      title={`${correction ? 'Corregir novedades y recalcular' : readOnly ? 'Ver novedades' : 'Editar novedades'} · ${initial.original.nombre}`}
      size="large"
      onClose={onClose}
      closeDisabled={busy}
      acceptButton={
        readOnly ? false : { label: 'Guardar y cerrar', disabled: busy }
      }
      onAccept={() => submit('close')}
      actions={
        readOnly ? undefined : (
          <FormDialogActions
            form="novedad-editor"
            busy={busy}
            loading={false}
            hasError={false}
            onUndo={() => {
              form.reset();
              setDetails(initial.detalles);
              setQuitar(initial.quitarFormulas);
            }}
          />
        )
      }
    >
      {correction && (
        <Notice tone="info">
          Al guardar se corregirán las novedades y se recalculará el recibo en
          una misma operación.
        </Notice>
      )}
      {error && <Notice>{error}</Notice>}
      <form
        id="novedad-editor"
        className="novedades-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(
            getSaveDestination((e.nativeEvent as SubmitEvent).submitter),
          );
        }}
      >
        <fieldset disabled={busy || readOnly}>
          <legend>Datos del período</legend>
          {(
            [
              'fechaPago',
              'diasTrabajados',
              'horasTrabajadas',
              'diasVacaciones',
            ] as const
          ).map((k, i) => (
            <label key={k}>
              {
                [
                  'Fecha de pago',
                  'Días trabajados',
                  'Horas trabajadas',
                  'Días de vacaciones',
                ][i]
              }
              <input
                type={i === 0 ? 'date' : 'text'}
                inputMode={i === 0 ? undefined : 'decimal'}
                {...form.register(k)}
              />
              {form.formState.errors[k] && (
                <span role="alert">{form.formState.errors[k]?.message}</span>
              )}
            </label>
          ))}
        </fieldset>
        <fieldset disabled={busy || readOnly}>
          <legend>Conceptos</legend>
          {initial.original.requeridas.map((f) => {
            const v = details[f.id];
            return (
              <div className="novedades-detail" key={f.id}>
                <div className="novedades-detail-data">
                  <strong>
                    {f.codigo} · {f.descripcion}
                  </strong>
                  <label>
                    Cantidad
                    <input
                      inputMode="decimal"
                      value={v?.cantidad ?? ''}
                      onChange={(e) => {
                        setQuitar((q) => q.filter((id) => id !== f.id));
                        setDetails((d) => ({
                          ...d,
                          [f.id]: {
                            cantidad: e.target.value,
                            importe: d[f.id]?.importe ?? '',
                            observaciones: d[f.id]?.observaciones ?? '',
                          },
                        }));
                      }}
                    />
                  </label>
                  <label>
                    Importe
                    <input
                      inputMode="decimal"
                      value={v?.importe ?? ''}
                      onChange={(e) => {
                        setQuitar((q) => q.filter((id) => id !== f.id));
                        setDetails((d) => ({
                          ...d,
                          [f.id]: {
                            cantidad: d[f.id]?.cantidad ?? '',
                            importe: e.target.value,
                            observaciones: d[f.id]?.observaciones ?? '',
                          },
                        }));
                      }}
                    />
                  </label>
                  <label>
                    Observaciones
                    <input
                      maxLength={255}
                      value={v?.observaciones ?? ''}
                      onChange={(e) => {
                        setQuitar((q) => q.filter((id) => id !== f.id));
                        setDetails((d) => ({
                          ...d,
                          [f.id]: {
                            cantidad: d[f.id]?.cantidad ?? '',
                            importe: d[f.id]?.importe ?? '',
                            observaciones: e.target.value,
                          },
                        }));
                      }}
                    />
                  </label>
                </div>
                <div className="novedades-detail-actions">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDetails((d) => ({
                        ...d,
                        [f.id]: {
                          cantidad: '0',
                          importe: '0',
                          observaciones: d[f.id]?.observaciones ?? '',
                        },
                      }));
                      setQuitar((q) => q.filter((id) => id !== f.id));
                    }}
                  >
                    Poner en cero
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={initial.original.idRecibo !== null}
                    onClick={() => {
                      setDetails((d) => {
                        const next = { ...d };
                        delete next[f.id];
                        return next;
                      });
                      setQuitar((q) => [...new Set([...q, f.id])]);
                    }}
                  >
                    Dejar pendiente
                  </Button>
                </div>
              </div>
            );
          })}
        </fieldset>
      </form>
    </Modal>
  );
}
