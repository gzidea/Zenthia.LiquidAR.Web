import { Notice } from '@/components/ui/Notice';
import { Button } from '@/components/ui/Button';
import { ApiError, errorMessage } from '@/services/http/ApiError';
import { ReciboZipError } from './reciboZipErrors';
import type { useRecibosZip } from './hooks';
export function ZipFeedback({
  zip,
  onCancel,
  onExcluir,
}: {
  zip: ReturnType<typeof useRecibosZip>;
  onCancel: () => void;
  onExcluir?: (ids: number[]) => void;
}) {
  return (
    <>
      {zip.isError &&
        !(zip.error instanceof ApiError && zip.error.kind === 'cancelled') && (
          <Notice>
            {errorMessage(zip.error)}
            {zip.error instanceof ReciboZipError && (
              <>
                <ul>
                  {zip.error.recibos.map((e) => (
                    <li key={e.reciboId}>
                      Recibo {e.reciboId}: {e.mensaje}
                    </li>
                  ))}
                </ul>
                {onExcluir && (
                  <Button
                    disabled={zip.isPending}
                    onClick={() =>
                      onExcluir(
                        zip.error instanceof ReciboZipError
                          ? zip.error.recibos.map((e) => e.reciboId)
                          : [],
                      )
                    }
                  >
                    Quitar recibos con error de la selección
                  </Button>
                )}
              </>
            )}
          </Notice>
        )}
      {zip.isPending && (
        <Notice tone="info">
          Preparando archivo…{' '}
          <Button onClick={onCancel}>Cancelar descarga</Button>
        </Notice>
      )}
    </>
  );
}
