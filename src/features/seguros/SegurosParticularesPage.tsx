import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataGrid, type DataGridColumn } from '@/components/ui/DataGrid';
import { DataGridSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';
import { empresaService } from '@/features/empresas/services/empresaService';
import { errorMessage } from '@/services/http/ApiError';
import { useSeguros } from './hooks';
import { SegurosDialog } from './SegurosDialog';
import type { Row } from './service';
import './seguros.css';

const baseColumns: DataGridColumn<Row>[] = [
  {
    field: 'regimen',
    header: 'Régimen',
    getValue: (r) =>
      r.regimen === 'casasParticulares' ? 'Casas particulares' : 'General',
  },
  {
    field: 'aseguradoraScvo',
    header: 'Aseguradora SCVO',
    getValue: (r) => r.aseguradoraScvo,
  },
  { field: 'polizaScvo', header: 'Póliza SCVO', getValue: (r) => r.polizaScvo },
  {
    field: 'aseguradoraArt',
    header: 'Aseguradora ART',
    getValue: (r) => r.aseguradoraArt,
  },
  {
    field: 'contratoArt',
    header: 'Contrato ART',
    getValue: (r) => r.contratoArt,
  },
  {
    field: 'alicuotaArt',
    header: 'Alícuota ART (%)',
    getValue: (r) => r.alicuotaArt ?? 'Sin definir',
  },
  {
    field: 'fijoArt',
    header: 'Fijo ART ($, sin FFEP)',
    getValue: (r) => r.fijoArt ?? 'Sin definir',
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
  { field: 'motivo', header: 'Motivo', getValue: (r) => r.version.motivo },
];
const columns = baseColumns.map((column) => ({
  ...column,
  sortable: false,
  filterable: false,
  searchable: false,
}));

export function SegurosParticularesPage() {
  const permissions = usePermissions();
  const id = useEmpresaContextStore((s) => s.empresaSeleccionadaId);
  useEffect(() => {
    document.title = 'Seguros Particulares SCVO / ART | Zenthia.LiquidAR.Web';
    if (!permissions.isPending)
      document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [permissions.isPending]);
  return (
    <section className="valores-generales-page">
      <h1 tabIndex={-1}>Seguros Particulares SCVO / ART</h1>
      {permissions.isPending ? (
        <DataGridSkeleton
          columns={6}
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
      ) : !permissions.can('empresas:read') ? (
        <Notice>
          No tenés permiso para consultar los seguros de empresas.
        </Notice>
      ) : id === null ? (
        <Notice tone="error">
          Primero seleccioná una empresa desde el selector del menú superior
          para consultar sus seguros.
        </Notice>
      ) : (
        <EmpresaSeguros
          key={id}
          id={id}
          canWrite={permissions.can('empresas:write')}
        />
      )}
    </section>
  );
}

function EmpresaSeguros({ id, canWrite }: { id: number; canWrite: boolean }) {
  const { query } = useSeguros('empresa', id);
  const detail = useQuery({
    queryKey: ['empresas', 'detail', id],
    queryFn: ({ signal }) => empresaService.detail(id, signal),
  });
  const [editor, setEditor] = useState<{ initial?: Row } | null>(null);
  const [feedback, setFeedback] = useState('');
  const nombre = detail.data?.empresa.nombre || `Empresa ${id}`;
  return (
    <>
      <p>
        Empresa: <strong>{nombre}</strong> · ID {id}
      </p>
      <p>
        La prima SCVO y el FFEP se obtienen de los valores oficiales. Aquí se
        publican las pólizas y condiciones ART de esta empresa.
      </p>
      {detail.isError && (
        <Notice>
          No se pudo cargar el nombre de la empresa.{' '}
          <Button onClick={() => void detail.refetch()}>
            Reintentar empresa
          </Button>
        </Notice>
      )}
      <DataGrid
        label="Seguros particulares de la empresa"
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
        emptyMessage="No hay configuración publicada para esta empresa."
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
          kind="empresa"
          id={id}
          nombre={`${nombre} · ID ${id}`}
          canWrite
          formOnly
          bindEmpresaContext
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
  );
}
