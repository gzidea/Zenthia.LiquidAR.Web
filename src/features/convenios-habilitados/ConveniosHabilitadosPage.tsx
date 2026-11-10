import { useEffect, useState } from 'react';
import {
  DataGrid,
  type DataGridColumn,
  type DataGridSelectionModel,
} from '@/components/ui/DataGrid';
import { DataGridSkeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useTenantContextStore } from '@/stores/tenantContextStore';
import type { ConvenioConfigurado } from '@/features/formulas-empresa/service';
import { errorMessage } from '@/services/http/ApiError';
import { useConveniosHabilitados } from './hooks';
import './convenios-habilitados.css';

const catalogColumns: DataGridColumn<ConvenioConfigurado>[] = [
  {
    field: 'id',
    header: 'ID',
    getValue: (r) => r.id,
    type: 'number',
    initiallyHidden: true,
  },
  {
    field: 'nombre',
    header: 'Convenio',
    getValue: (r) => r.nombre,
    minWidth: 240,
  },
];
const columns: DataGridColumn<ConvenioConfigurado>[] = [
  ...catalogColumns,
  {
    field: 'habilitado',
    header: 'Estado',
    getValue: (r) => (r.habilitado ? 'Habilitado' : 'Deshabilitado'),
  },
];
const emptySelection: DataGridSelectionModel = { type: 'include', ids: [] };

export function ConveniosHabilitadosPage() {
  const permissions = usePermissions();
  const selectedTenant = useTenantContextStore((s) => s.tenant);
  const needsTenant = permissions.data?.isSuperAdmin && !selectedTenant;
  const revision = useAuthStore((s) => s.revision);
  const canRead =
    !needsTenant &&
    !permissions.isError &&
    Boolean(
      permissions.can('habilitar-convenio:read') &&
      (permissions.data?.tenantId ?? 0) > 0,
    );
  const canWrite = canRead && permissions.can('habilitar-convenio:write');
  const { catalogo, agregar, cambiarEstado } = useConveniosHabilitados(canRead);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] =
    useState<DataGridSelectionModel>(emptySelection);
  const [feedback, setFeedback] = useState('');
  const busy = agregar.isPending || cambiarEstado.isPending;
  const data = catalogo.data ?? [];
  const selected =
    selection.type === 'include'
      ? selection.ids.filter((id): id is number => typeof id === 'number')
      : [];
  const pending = permissions.isPending;
  useEffect(() => {
    setOpen(false);
    setSelection(emptySelection);
    setFeedback('');
  }, [revision, permissions.data?.tenantId]);
  useEffect(() => {
    if (!catalogo.data) return;
    const disponibles = new Set(
      catalogo.data.filter((row) => !row.agregado).map((row) => row.id),
    );
    setSelection((previous) => {
      if (previous.type !== 'include') return previous;
      const ids = previous.ids.filter(
        (id) => typeof id === 'number' && disponibles.has(id),
      );
      return ids.length === previous.ids.length
        ? previous
        : { type: 'include', ids };
    });
  }, [catalogo.data]);
  useEffect(() => {
    document.title = 'Convenios habilitados | Zenthia.LiquidAR.Web';
    if (!pending)
      document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [pending]);
  async function submit() {
    if (!canWrite || busy || catalogo.isFetching || selected.length === 0)
      return;
    try {
      await agregar.mutateAsync(selected);
      setOpen(false);
      setSelection(emptySelection);
      setFeedback('Los convenios seleccionados se agregaron como habilitados.');
    } catch {
      /* Keep selection and render the normalized error in the modal. */
    }
  }
  async function toggle(row: ConvenioConfigurado) {
    if (!canWrite || busy) return;
    setFeedback('');
    try {
      await cambiarEstado.mutateAsync({
        id: row.id,
        habilitado: !row.habilitado,
      });
      setFeedback(
        `El convenio ${row.nombre ?? row.id} quedó ${row.habilitado ? 'deshabilitado' : 'habilitado'}.`,
      );
    } catch {
      /* The page renders the mutation error. */
    }
  }
  return (
    <section className="convenios-habilitados-page">
      <h1 tabIndex={-1}>Convenios habilitados</h1>
      <p>
        Esta configuración se comparte entre todas las empresas del cliente.
        Deshabilitar un convenio lo conserva en la lista.
      </p>
      {pending ? (
        <DataGridSkeleton
          columns={2}
          selection
          actions
          label="Cargando permisos…"
        />
      ) : permissions.isError ? (
        <>
          <Notice>{errorMessage(permissions.error)}</Notice>
          <Button
            onClick={() => {
              void permissions.refetch();
            }}
          >
            Reintentar permisos
          </Button>
        </>
      ) : needsTenant ? (
        <Notice>
          Seleccioná un tenant desde el menú superior para administrar sus
          convenios habilitados.
        </Notice>
      ) : !canRead ? (
        <Notice>
          No tenés un contexto autorizado para consultar los convenios del
          cliente.
        </Notice>
      ) : (
        <>
          <DataGrid
            label="Convenios habilitados del cliente"
            rows={catalogo.isError ? [] : data.filter((r) => r.agregado)}
            columns={columns}
            getRowId={(r) => r.id}
            initialState={{ pagination: { page: 0, pageSize: 25 } }}
            pageSizeOptions={[10, 25, 50, 100]}
            rowHeight={48}
            selectionMode="multiple"
            checkboxSelection
            selectAll="page"
            loading={catalogo.isFetching}
            error={catalogo.isError ? errorMessage(catalogo.error) : null}
            onRetry={() => void catalogo.refetch()}
            emptyMessage="No hay convenios agregados."
            globalActions={[
              {
                id: 'refresh',
                label: 'Refrescar',
                disabled: busy || catalogo.isFetching,
                onClick: () => void catalogo.refetch(),
              },
              {
                id: 'create',
                label: 'Agregar',
                icon: <Icon name="plus" />,
                display: 'icon-text',
                visible: canWrite,
                disabled: busy || catalogo.isFetching || !catalogo.data,
                onClick: () => {
                  agregar.reset();
                  cambiarEstado.reset();
                  setFeedback('');
                  setSelection(emptySelection);
                  setOpen(true);
                },
              },
            ]}
            rowActions={[
              {
                id: 'enable',
                label: 'Habilitar',
                visible: (r) => canWrite && !r.habilitado,
                disabled: () => busy || catalogo.isFetching,
                onClick: (r) => void toggle(r),
              },
              {
                id: 'disable',
                label: 'Deshabilitar',
                visible: (r) => canWrite && r.habilitado,
                disabled: () => busy || catalogo.isFetching,
                onClick: (r) => void toggle(r),
              },
            ]}
          />
          {cambiarEstado.isError && (
            <Notice>{errorMessage(cambiarEstado.error)}</Notice>
          )}
          {feedback && <p role="status">{feedback}</p>}
          <Modal
            open={open && canWrite}
            title="Agregar convenios"
            size="large"
            closeDisabled={busy}
            onClose={() => {
              if (!busy) setOpen(false);
            }}
            onAccept={submit}
            acceptButton={{
              label: 'Agregar seleccionados',
              loading: agregar.isPending,
              disabled:
                selected.length === 0 ||
                busy ||
                catalogo.isFetching ||
                catalogo.isError,
            }}
            cancelButton={{ label: 'Cancelar' }}
          >
            <p>
              Buscá y seleccioná uno o varios convenios. Los ya agregados se
              administran desde la grilla principal.
            </p>
            <DataGrid
              label="Convenios disponibles"
              keepSelectionOnQueryChange
              rows={data.filter((r) => !r.agregado)}
              columns={catalogColumns}
              getRowId={(r) => r.id}
              initialState={{ pagination: { page: 0, pageSize: 25 } }}
              pageSizeOptions={[10, 25, 50, 100]}
              rowHeight={48}
              selectionMode="multiple"
              checkboxSelection
              selectAll="page"
              selectionModel={selection}
              onSelectionModelChange={setSelection}
              loading={catalogo.isFetching || agregar.isPending}
              error={catalogo.isError ? errorMessage(catalogo.error) : null}
              onRetry={() => void catalogo.refetch()}
              emptyMessage="No hay convenios disponibles para agregar."
            />
            {agregar.isError && (
              <Notice>
                {errorMessage(agregar.error)}{' '}
                <Button
                  variant="ghost"
                  disabled={busy || catalogo.isFetching}
                  onClick={() => void catalogo.refetch()}
                >
                  Actualizar convenios
                </Button>
              </Notice>
            )}
          </Modal>
        </>
      )}
    </section>
  );
}
