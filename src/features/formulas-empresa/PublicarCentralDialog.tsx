import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormulaFormSkeleton } from '@/features/formulas/components/FormulaForm';
import { errorMessage } from '@/services/http/ApiError';
import { FormulaEmpresaEditor } from './ConfiguracionEditors';
import { formulasEmpresaApi as api, type PublicacionWrite } from './service';

export function PublicarCentralDialog({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const revision = useAuthStore((s) => s.revision);
  const [key, setKey] = useState(0);
  const [feedback, setFeedback] = useState('');
  const client = useQueryClient();
  const data = useQuery({
    queryKey: ['formulas-empresa', revision, 'publicar-central', id],
    queryFn: ({ signal }) => api.borradorCentral(id, signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const catalogos = useQuery({
    queryKey: ['formulas-empresa', revision, 'catalogos-centrales'],
    queryFn: ({ signal }) => api.catalogosCentrales(signal),
  });
  const save = useMutation({
    mutationFn: (r: PublicacionWrite) => api.publicarCentral(id, r),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['formulas'] });
    },
  });
  const undo = async () => {
    save.reset();
    await data.refetch();
    setKey((k) => k + 1);
  };
  if (
    data.isPending ||
    catalogos.isPending ||
    data.isError ||
    catalogos.isError
  )
    return (
      <Modal
        open
        title="Publicar versión central"
        size="large"
        onClose={onClose}
        acceptButton={false}
      >
        {data.isError || catalogos.isError ? (
          <>
            <p role="alert">{errorMessage(data.error ?? catalogos.error)}</p>
            <Button
              onClick={() => {
                void data.refetch();
                void catalogos.refetch();
              }}
            >
              Reintentar
            </Button>
          </>
        ) : (
          <FormulaFormSkeleton />
        )}
      </Modal>
    );
  return (
    <>
      {feedback && <p role="status">{feedback}</p>}
      <FormulaEmpresaEditor
        key={key}
        initial={data.data}
        catalogos={catalogos.data}
        central
        busy={save.isPending}
        readOnly={false}
        error={save.error}
        onClose={onClose}
        onUndo={() => void undo()}
        onSave={async (r, destino) => {
          try {
            await save.mutateAsync(r);
            if (destino === 'close') onClose();
            else {
              await data.refetch();
              setKey((k) => k + 1);
              setFeedback('Versión central publicada correctamente.');
            }
          } catch {
            /* Preserve draft. */
          }
        }}
      />
    </>
  );
}
