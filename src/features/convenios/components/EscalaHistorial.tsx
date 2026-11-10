import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { DataGrid, type DataGridColumn } from '@/components/ui/DataGrid';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/services/http/ApiError';
import { useEscalasMutations, useHistorial } from '../hooks/useConvenios';
import { monthInput } from '../schemas/convenioSchema';
import type { CategoriaResumen, VersionImporte } from '../types/convenio';
const columns: DataGridColumn<VersionImporte>[] = [
  {
    field: 'desde',
    header: 'Desde',
    getValue: (r: VersionImporte) => r.periodoDesde.slice(0, 7),
  },
  {
    field: 'revision',
    header: 'Revisión',
    getValue: (r: VersionImporte) => r.revision,
  },
  {
    field: 'importe',
    header: 'Importe',
    getValue: (r: VersionImporte) => r.importe ?? 'Sin importe',
  },
  {
    field: 'adicional1',
    header: 'Adicional 1',
    getValue: (r: VersionImporte) => r.adicional1 ?? 'Sin importe',
  },
  {
    field: 'adicional2',
    header: 'Adicional 2',
    getValue: (r: VersionImporte) => r.adicional2 ?? 'Sin importe',
  },
  {
    field: 'origen',
    header: 'Origen',
    getValue: (r: VersionImporte) => r.origen,
  },
  {
    field: 'base',
    header: 'Versión base',
    getValue: (r: VersionImporte) => r.idVersionBase,
  },
  {
    field: 'motivo',
    header: 'Motivo',
    getValue: (r: VersionImporte) => r.motivo,
  },
  {
    field: 'fecha',
    header: 'Creada',
    getValue: (r: VersionImporte) => r.creadoEn,
  },
  {
    field: 'usuario',
    header: 'Usuario',
    getValue: (r: VersionImporte) => r.creadoPorUserId ?? r.creadoPorUserGuid,
  },
].map((c) => ({ ...c, sortable: false, filterable: false, searchable: false }));
const cancelSchema = z.object({
  motivo: z.string().trim().min(1, 'Ingresá un motivo.').max(1000),
  dependencias: z.boolean(),
});
export function EscalaHistorial({
  convenioId,
  row,
  operativo,
  canWrite,
  onClose,
  onRevise,
}: {
  convenioId: number;
  row: CategoriaResumen;
  operativo: string;
  canWrite: boolean;
  onClose: () => void;
  onRevise: (mes: string) => void;
}) {
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [target, setTarget] = useState<VersionImporte | null>(null);
  const query = useHistorial(
    row.categoria.id,
    pagination.page + 1,
    pagination.pageSize,
  );
  const { cancel } = useEscalasMutations(convenioId);
  const form = useForm<z.infer<typeof cancelSchema>>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { motivo: '', dependencias: false },
  });
  const future = (v: VersionImporte) =>
    v.periodoDesde.slice(0, 7) > monthInput(operativo);
  return (
    <>
      <Modal
        open
        size="large"
        title="Historial de escalas"
        subtitle={row.categoria.descripcion ?? undefined}
        onClose={onClose}
        acceptButton={false}
        cancelButton={{ label: 'Cerrar' }}
      >
        <DataGrid
          label="Revisiones de la categoría"
          rows={query.data?.items ?? []}
          columns={columns}
          getRowId={(r) => r.id}
          processingMode="server"
          rowCount={query.data?.total ?? 0}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          pageSizeOptions={[10, 25, 50, 100]}
          rowHeight={48}
          searchDisabled
          filterButtonDisabled
          loading={query.isFetching}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyMessage="Esta categoría todavía no tiene escalas."
          rowActions={[
            {
              id: 'revise',
              label: 'Revisar período',
              visible: (r) => canWrite && future(r),
              onClick: (r) => onRevise(r.periodoDesde.slice(0, 7)),
            },
            {
              id: 'cancel',
              label: 'Anular versión',
              visible: (r) => canWrite && future(r) && r.origen !== 'ANULACION',
              onClick: (r) => {
                cancel.reset();
                form.reset();
                setTarget(r);
              },
            },
          ]}
        />
        <p className="field-note">
          Las revisiones anteriores se conservan para auditoría. Sólo puede
          anularse la última revisión de un inicio futuro que tenga una escala
          anterior.
        </p>
      </Modal>
      <Modal
        open={target !== null}
        title="Anular programación"
        onClose={() => {
          if (!cancel.isPending) setTarget(null);
        }}
        closeDisabled={cancel.isPending}
        acceptButton={{
          label: 'Confirmar anulación',
          type: 'submit',
          form: 'anular-escala',
          loading: cancel.isPending,
        }}
        cancelButton={{ disabled: cancel.isPending }}
      >
        <form
          id="anular-escala"
          className="convenio-form convenio-fields"
          onSubmit={form.handleSubmit(async (v) => {
            if (!target || cancel.isPending || !canWrite) return;
            try {
              await cancel.mutateAsync({
                categoria: row.categoria.id,
                version: target.id,
                revision: target.revision,
                motivo: v.motivo,
                dependencias: v.dependencias,
              });
              setTarget(null);
            } catch {
              /* Keep reason for retry. */
            }
          })}
        >
          <p>
            Se anulará el inicio {target?.periodoDesde.slice(0, 7)}. La escala
            anterior continuará vigente.
          </p>
          <Input
            label="Motivo"
            {...form.register('motivo')}
            error={form.formState.errors.motivo?.message}
            disabled={cancel.isPending}
          />
          <label className="convenio-check">
            <input
              type="checkbox"
              {...form.register('dependencias')}
              disabled={cancel.isPending}
            />
            Si hay escalas dependientes, confirmo conservar sus importes.
          </label>
          {cancel.isError && <Notice>{errorMessage(cancel.error)}</Notice>}
        </form>
      </Modal>
    </>
  );
}
