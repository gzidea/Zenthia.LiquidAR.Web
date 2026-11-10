import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Notice } from '@/components/ui/Notice';
import {
  DataGrid,
  type DataGridColumn,
  type DataGridSelectionModel,
  type DataGridSortModel,
} from '@/components/ui/DataGrid';
import { useLiquidacionesCapacidades } from '@/features/liquidaciones/hooks';
import { errorMessage, ApiError } from '@/services/http/ApiError';
import { descargar } from '@/services/http/downloadFile';
import { formatMoneda } from '@/features/novedades/moneda';
import { useRecibosListado, useRecibosZip } from './hooks';
import type { ReciboListado, ReciboResumen } from './listado';
import { ZipFeedback } from './ZipFeedback';
import { ReciboPreviewDialog } from './ReciboPreviewDialog';
import { recibosService } from './service';
import '@/features/novedades/novedades.css';

export function RecibosPage() {
  const caps = useLiquidacionesCapacidades();
  const canRead = caps.data?.leer === true;
  const now = new Date();
  const [mes, setMes] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [tipo, setTipo] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [buscar, setBuscar] = useState('');
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [sort, setSort] = useState<DataGridSortModel>({
    field: 'codigo',
    direction: 'asc',
  });
  const [selection, setSelection] = useState<DataGridSelectionModel>({
    type: 'include',
    ids: [],
  });
  const [preview, setPreview] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const zip = useRecibosZip();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const periodo = mes ? mes.slice(5, 7) + mes.slice(0, 4) : undefined;
  const filter = {
    page: pagination.page + 1,
    pageSize: pagination.pageSize,
    ...(empresa ? { empresaId: Number(empresa) } : {}),
    ...(periodo ? { periodo } : {}),
    ...(tipo ? { idTipoLiquidacion: Number(tipo) } : {}),
    buscar,
    orden: sort?.field ?? 'codigo',
    descendente: sort?.direction === 'desc',
  };
  const q = useRecibosListado(filter, canRead);
  const rows = q.filas.data?.items ?? [];
  const busy = zip.isPending || pdfBusy;
  const ids = rows
    .filter(
      (r) =>
        selection.type === 'include' && selection.ids.includes(r.recibo.id),
    )
    .map((r) => r.recibo.id);
  const reset = () => {
    setSelection({ type: 'include', ids: [] });
    setPagination((p) => ({ ...p, page: 0 }));
    setMessage('');
    zip.reset();
  };
  useEffect(() => {
    const total = q.filas.data?.total;
    if (
      total !== undefined &&
      pagination.page > 0 &&
      pagination.page * pagination.pageSize >= total
    ) {
      setSelection({ type: 'include', ids: [] });
      setPagination((p) => ({
        ...p,
        page: Math.max(0, Math.ceil(total / p.pageSize) - 1),
      }));
    }
  }, [q.filas.data, pagination.page, pagination.pageSize]);
  const pdf = async (id: number) => {
    if (busy) return;
    setPdfBusy(true);
    setMessage('');
    try {
      const file = await recibosService.pdf(id);
      descargar(file.blob, file.nombre);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPdfBusy(false);
    }
  };
  const download = () => {
    if (busy || !ids.length || ids.length > 100) return;
    setMessage('');
    const abort = new AbortController();
    controller.current = abort;
    zip.mutate(
      { ids, signal: abort.signal },
      {
        onSuccess: (file) => {
          descargar(file.blob, file.nombre);
          setMessage('Descarga del ZIP iniciada.');
        },
        onError: (e) => {
          if (e instanceof ApiError && e.kind === 'cancelled')
            setMessage('Descarga cancelada.');
        },
        onSettled: () => {
          if (controller.current === abort) controller.current = null;
        },
      },
    );
  };
  const money = (
    field: string,
    header: string,
    key: keyof ReciboResumen,
  ): DataGridColumn<ReciboListado> => ({
    field,
    header,
    getValue: (r) => r.recibo[key],
    align: 'right',
    minWidth: 150,
    width: 150,
    render: (r) =>
      r.recibo[key] == null ? 'Sin calcular' : formatMoneda(r.recibo[key]),
  });
  const columns: DataGridColumn<ReciboListado>[] = [
    {
      field: 'codigo',
      header: 'Código de legajo',
      getValue: (r) => r.codigoLegajo,
      minWidth: 140,
      width: 140,
      render: (r) => r.codigoLegajo ?? 'Sin legajo',
    },
    {
      field: 'apellidos',
      header: 'Apellido',
      getValue: (r) => r.apellidos,
      minWidth: 160,
      width: 160,
      render: (r) => r.apellidos ?? 'Sin legajo relacionado',
    },
    {
      field: 'nombres',
      header: 'Nombre',
      getValue: (r) => r.nombres,
      minWidth: 160,
      width: 160,
    },
    {
      field: 'cuil',
      header: 'CUIL',
      getValue: (r) => r.cuil,
      minWidth: 160,
      width: 160,
    },
    {
      field: 'empresa',
      initiallyHidden: true,
      header: 'Empresa',
      getValue: (r) => r.empresa,
      minWidth: 180,
      sortable: false,
    },
    {
      field: 'periodo',
      initiallyHidden: true,
      header: 'Período',
      getValue: (r) => r.recibo.periodo,
      minWidth: 110,
    },
    {
      field: 'tipo',
      initiallyHidden: true,
      header: 'Tipo',
      getValue: (r) => r.tipoLiquidacion,
      minWidth: 150,
      sortable: false,
    },
    {
      field: 'fechaPago',
      initiallyHidden: true,
      header: 'Fecha de pago',
      getValue: (r) => r.recibo.fechaPago,
      minWidth: 140,
      render: (r) =>
        r.recibo.fechaPago.slice(0, 10).split('-').reverse().join('/'),
    },
    money('sueldoBruto', 'Sueldo bruto', 'sueldoBruto'),
    money('remunerativo', 'Remunerativo', 'totalRemunerativos'),
    money('noRemunerativo', 'No remunerativo', 'totalNoRemunerativos'),
    money('descuentos', 'Descuentos', 'totalDescuentos'),
    money('netoACobrar', 'Neto a cobrar', 'netoACobrar'),
    money('totalContribuciones', 'Total contribuciones', 'totalContribuciones'),
    money('costoTotal', 'Costo total', 'totalCostoLaboral'),
  ];
  if (caps.isPending) return <p role="status">Verificando permisos…</p>;
  if (caps.isError)
    return (
      <Notice>
        {errorMessage(caps.error)}{' '}
        <Button onClick={() => void caps.refetch()}>Reintentar</Button>
      </Notice>
    );
  if (!canRead)
    return <Notice>No tenés permiso para consultar recibos.</Notice>;
  return (
    <section className="novedades-work">
      <h1>Recibos</h1>
      <p>
        Consultá los importes guardados y descargá los recibos seleccionados.
      </p>
      <div className="novedades-context">
        <label>
          Período
          <input
            type="month"
            value={mes}
            disabled={busy}
            onChange={(e) => {
              setMes(e.target.value);
              setEmpresa('');
              reset();
            }}
          />
        </label>
        <label>
          Tipo de liquidación
          <Select
            value={tipo}
            disabled={busy}
            onChange={(e) => {
              setTipo(e.target.value);
              setEmpresa('');
              reset();
            }}
          >
            <option value="">Seleccionar</option>
            {q.tipos.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Empresa
          <Select
            value={empresa}
            disabled={busy || !tipo}
            onChange={(e) => {
              setEmpresa(e.target.value);
              reset();
            }}
          >
            <option value="">Todas</option>
            {q.empresas.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {(q.tipos.isError || q.empresas.isError) && (
        <Notice>
          {errorMessage(q.tipos.error ?? q.empresas.error)}{' '}
          <Button
            onClick={() => {
              void q.tipos.refetch();
              void q.empresas.refetch();
            }}
          >
            Reintentar catálogos
          </Button>
        </Notice>
      )}
      {message && (
        <Notice
          tone={
            message === 'Descarga del ZIP iniciada.'
              ? 'success'
              : message === 'Descarga cancelada.'
                ? 'info'
                : 'error'
          }
        >
          {message}
        </Notice>
      )}
      <ZipFeedback
        zip={zip}
        onCancel={() => controller.current?.abort()}
        onExcluir={(failed) => {
          setSelection({
            type: 'include',
            ids: ids.filter((id) => !failed.includes(id)),
          });
          zip.reset();
        }}
      />
      {!tipo || !mes ? (
        <Notice tone="info">
          Elegí período y tipo de liquidación para consultar los recibos.
        </Notice>
      ) : (
        <>
          <div className="novedades-tools">
            <span>
              {ids.length} recibos seleccionados · selección de la página actual
            </span>
            <Button
              disabled={
                busy || q.filas.isFetching || !ids.length || ids.length > 100
              }
              onClick={download}
            >
              Descargar seleccionados en ZIP ({ids.length})
            </Button>
            <Button
              disabled={busy || q.filas.isFetching}
              onClick={() => void q.filas.refetch()}
            >
              Refrescar
            </Button>
          </div>
          <DataGrid
            label="Recibos guardados"
            rows={rows}
            columns={columns.map((c) => ({ ...c, filterable: false }))}
            getRowId={(r) => r.recibo.id}
            processingMode="server"
            rowCount={q.filas.data?.total ?? 0}
            paginationModel={pagination}
            onPaginationModelChange={(p) => {
              setPagination(p);
              setSelection({ type: 'include', ids: [] });
              zip.reset();
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            rowHeight={48}
            sortModel={sort}
            onSortModelChange={(s) => {
              setSort(s);
              reset();
            }}
            search={buscar}
            onSearchChange={(s) => {
              setBuscar(s.slice(0, 100));
              reset();
            }}
            showFilterButton={false}
            loading={q.filas.isFetching || busy}
            error={q.filas.isError ? errorMessage(q.filas.error) : null}
            onRetry={() => void q.filas.refetch()}
            checkboxSelection
            selectionMode="multiple"
            selectAll="page"
            selectionModel={selection}
            onSelectionModelChange={setSelection}
            rowActions={[
              {
                id: 'ver',
                label: 'Ver recibo',
                onClick: (r) => {
                  setMessage('');
                  setPreview(r.recibo.id);
                },
              },
              {
                id: 'pdf',
                label: 'Descargar PDF',
                onClick: (r) => void pdf(r.recibo.id),
              },
            ]}
          />
        </>
      )}
      {preview !== null && (
        <ReciboPreviewDialog
          target={{ id: preview }}
          busy={busy}
          canRecalculate={false}
          dirty={false}
          feedback={message}
          onClose={() => setPreview(null)}
          onPdf={(id) => void pdf(id)}
          onRecalcular={() => {}}
        />
      )}
    </section>
  );
}
