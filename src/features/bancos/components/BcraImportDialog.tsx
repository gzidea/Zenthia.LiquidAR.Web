import { useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { ApiError, errorMessage } from '@/services/http/ApiError';
import { useBcraImport } from '../hooks/useBancos';
import { BcraImportError } from '../services/bcraResult';

export function BcraImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mutation = useBcraImport();
  const { reset } = mutation;
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);
  const result =
    mutation.data ??
    (mutation.error instanceof BcraImportError ? mutation.error.result : null);
  const finished = mutation.isSuccess || mutation.isError;
  const uncertain =
    mutation.error instanceof ApiError &&
    ['network', 'cancelled', 'contract'].includes(mutation.error.kind);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Actualizar desde BCRA"
      closeDisabled={mutation.isPending}
      cancelButton={{
        label: finished ? 'Cerrar' : 'Cancelar',
        disabled: mutation.isPending,
      }}
      acceptButton={
        finished ? false : { label: 'Actualizar', loading: mutation.isPending }
      }
      onAccept={async () => {
        if (mutation.isPending || finished) return;
        try {
          await mutation.mutateAsync();
        } catch {
          /* Normalized mutation error is shown below. */
        }
      }}
    >
      <p>
        Incorpora los códigos de bancos faltantes desde BCRA. Los bancos
        existentes no se modifican.
      </p>
      <p>
        Si algún registro falla, los bancos ya incorporados permanecen
        guardados.
      </p>
      {mutation.isPending && (
        <p role="status">Actualizando bancos desde BCRA…</p>
      )}
      {mutation.isError && <Notice>{errorMessage(mutation.error)}</Notice>}
      {uncertain && (
        <p>
          No se pudo confirmar el resultado. Revisá el listado antes de volver a
          ejecutar la actualización; puede haber bancos incorporados.
        </p>
      )}
      {result && (
        <div className="bcra-result">
          <p role="status">
            {result.fallidos.length
              ? 'Actualización con errores.'
              : 'Actualización completada.'}{' '}
            Incorporados: {result.incorporados}. Omitidos: {result.omitidos}.
            Fallidos: {result.fallidos.length}.
          </p>
          {result.fallidos.length > 0 && (
            <ul aria-label="Bancos no incorporados">
              {result.fallidos.map((failure, index) => (
                <li key={`${failure.codigoEntidad}-${index}`}>
                  Código {failure.codigoEntidad}: {failure.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
