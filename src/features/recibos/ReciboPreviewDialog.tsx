import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Skeleton } from '@/components/ui/Skeleton';
import { ReciboPreview } from '@/components/recibos/ReciboPreview';
import { errorMessage } from '@/services/http/ApiError';
import { useReciboPreview, type ReciboPreviewTarget } from './hooks';

export function ReciboPreviewDialog({
  target,
  busy,
  canRecalculate,
  dirty,
  onClose,
  onRecalcular,
  onPdf,
  feedback,
}: {
  target: ReciboPreviewTarget;
  busy: boolean;
  canRecalculate: boolean;
  dirty: boolean;
  onClose: () => void;
  onRecalcular: (id: number) => void;
  onPdf: (id: number) => void;
  feedback?: string;
}) {
  const q = useReciboPreview(target);
  const loading = q.isPending || q.isFetching;
  const id = !loading && !q.isError ? q.data?.id : null;
  return (
    <Modal
      open
      title="Previsualización del recibo"
      size="large"
      fullWidth
      onClose={onClose}
      closeDisabled={busy}
      acceptButton={false}
      cancelButton={{ label: 'Cerrar' }}
      actions={
        <>
          {id != null && canRecalculate && (
            <Button disabled={busy || dirty} onClick={() => onRecalcular(id)}>
              Recalcular recibo
            </Button>
          )}
          {id != null && q.data?.datosCompletos && (
            <Button disabled={busy} onClick={() => onPdf(id)}>
              Descargar PDF
            </Button>
          )}
        </>
      }
    >
      {feedback && <Notice>{feedback}</Notice>}
      {loading && (
        <div
          className="receipt-receipt"
          role="status"
          aria-label="Cargando previsualización"
          aria-busy="true"
        >
          <Skeleton width="60%" height={28} />
          <Skeleton width="80%" />
          <Skeleton width="45%" />
          <Skeleton variant="rectangular" height={140} />
          <Skeleton variant="rectangular" height={28} />
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height={24} />
          ))}
          <Skeleton variant="rectangular" height={60} />
        </div>
      )}
      {q.isError && (
        <Notice>
          {errorMessage(q.error)}{' '}
          <Button onClick={() => void q.refetch()}>Reintentar</Button>
        </Notice>
      )}
      {dirty && (
        <Notice tone="info">
          Guardá o descartá las novedades pendientes antes de recalcular. La
          vista muestra los datos anteriores.
        </Notice>
      )}
      {q.data && !loading && !q.isError && (
        <ReciboPreview result={q.data.result} />
      )}
    </Modal>
  );
}
