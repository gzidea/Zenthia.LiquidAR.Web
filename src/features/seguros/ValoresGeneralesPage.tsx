import { useEffect, useState } from 'react';
import { DataGrid, type DataGridColumn } from '@/components/ui/DataGrid';
import { DataGridSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { errorMessage } from '@/services/http/ApiError';
import { useSeguros } from './hooks';
import { codigos, SegurosDialog } from './SegurosDialog';
import type { Row } from './service';
import './seguros.css';

const baseColumns: DataGridColumn<Row>[] = [
  {
    field: 'codigo',
    header: 'Parámetro',
    getValue: (r) => codigos[r.codigo as keyof typeof codigos] ?? r.codigo,
    width: 290,
  },
  {
    field: 'regimen',
    header: 'Régimen',
    getValue: (r) =>
      r.regimen === 'casasParticulares' ? 'Casas particulares' : 'General',
  },
  {
    field: 'valor',
    header: 'Importe oficial ($)',
    getValue: (r) => r.valor,
    align: 'right',
    format: (value) => {
      const [integer = '', fraction = ''] = String(value ?? '').split('.');
      return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction.padEnd(2, '0')}`;
    },
  },
  {
    field: 'desde',
    header: 'Desde',
    getValue: (r) => r.version.desde.slice(0, 7),
  },
  {
    field: 'hasta',
    header: 'Hasta',
    getValue: (r) => r.version.hasta?.slice(0, 7) ?? 'Sin límite',
  },
  {
    field: 'revision',
    header: 'Revisión',
    getValue: (r) => r.version.revision,
    type: 'number',
  },
  { field: 'fuente', header: 'Fuente normativa', getValue: (r) => r.fuente },
  { field: 'motivo', header: 'Motivo', getValue: (r) => r.version.motivo },
];
const columns = baseColumns.map((column) => ({
  ...column,
  sortable: false,
  filterable: false,
  searchable: false,
}));

export function ValoresGeneralesPage() {
  const permissions = usePermissions();
  const canRead = permissions.can('empresas:read');
  const canWrite =
    canRead &&
    Boolean(permissions.data?.isSuperAdmin) &&
    permissions.can('formulas:write');
  const { query } = useSeguros('oficial', undefined, canRead);
  const [editor, setEditor] = useState<{ initial?: Row } | null>(null);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    document.title = 'Valores Generales SCVO / FFEP | Zenthia.LiquidAR.Web';
    if (!permissions.isPending)
      document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [permissions.isPending]);
  return (
    <section className="valores-generales-page">
      <h1 tabIndex={-1}>Valores Generales SCVO / FFEP</h1>
      {permissions.isPending ? (
        <DataGridSkeleton
          columns={8}
          selection
          actions
          label="Cargando permisos…"
        />
      ) : permissions.isError ? (
        <>
          <Notice>{errorMessage(permissions.error)}</Notice>
          <Button onClick={() => void permissions.refetch()}>
            Reintentar permisos
          </Button>
        </>
      ) : !canRead ? (
        <Notice>No tenés permiso para consultar los valores generales.</Notice>
      ) : (
        <>
          <p>
            Valores compartidos por todos los clientes. Se publican por fuente
            normativa y período de vigencia; no se actualizan automáticamente.
          </p>
          <DataGrid
            label="Valores Generales SCVO / FFEP"
            rows={query.isError ? [] : (query.data ?? [])}
            columns={columns}
            getRowId={(r) => r.version.id}
            initialState={{ pagination: { page: 0, pageSize: 25 } }}
            pageSizeOptions={[10, 25, 50, 100]}
            rowHeight={48}
            selectionMode="multiple"
            checkboxSelection
            selectAll="page"
            searchDisabled
            filterButtonDisabled
            searchUnavailableReason="La consulta actual no ofrece búsqueda."
            filtersUnavailableReason="La consulta actual no ofrece filtros."
            loading={query.isFetching}
            error={query.isError ? errorMessage(query.error) : null}
            onRetry={() => void query.refetch()}
            emptyMessage="No hay configuración publicada."
            globalActions={[
              {
                id: 'refresh',
                label: 'Refrescar',
                disabled: query.isFetching,
                onClick: () => void query.refetch(),
              },
              {
                id: 'create',
                label: 'Nuevo',
                icon: <Icon name="plus" />,
                display: 'icon-text',
                visible: canWrite,
                disabled: query.isFetching || !query.data,
                onClick: () => {
                  setFeedback('');
                  setEditor({});
                },
              },
            ]}
            rowActions={[
              {
                id: 'copy',
                label: 'Copiar',
                visible: () => canWrite,
                disabled: () => query.isFetching,
                onClick: (row) => {
                  setFeedback('');
                  setEditor({ initial: row });
                },
              },
            ]}
          />
          {feedback && <p role="status">{feedback}</p>}
          {editor && canWrite && (
            <SegurosDialog
              kind="oficial"
              canWrite
              formOnly
              initial={editor.initial}
              onClose={() => setEditor(null)}
              onPublished={() => {
                setEditor(null);
                setFeedback(
                  'Nueva revisión publicada. Los recibos guardados conservan sus valores hasta una adopción explícita.',
                );
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
