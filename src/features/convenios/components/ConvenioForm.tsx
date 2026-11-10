import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { DataGrid, type DataGridColumn } from '@/components/ui/DataGrid';
import { Modal } from '@/components/ui/Modal';
import {
  getSaveDestination,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { Skeleton, DataGridSkeleton } from '@/components/ui/Skeleton';
import { CategoriaEditor } from './CategoriaEditor';
import {
  convenioFields,
  convenioSchema,
  toWrite,
  type ConvenioFields,
} from '../schemas/convenioSchema';
import type {
  CategoriaCambio,
  ConvenioCompleto,
  ConvenioWrite,
} from '../types/convenio';
type Row = CategoriaCambio & {
  key: string;
  historia: boolean;
  importe: string | null;
};
const columns: DataGridColumn<Row>[] = [
  {
    field: 'codigo',
    header: 'Código',
    width: 85,
    minWidth: 70,
    getValue: (r) => r.codigo,
  },
  {
    field: 'descripcion',
    width: 200,
    header: 'Descripción',
    getValue: (r) => r.descripcion,
  },
  {
    field: 'condicion',
    width: 110,
    header: 'Condición',
    getValue: (r) =>
      r.condicionLiquidacion === 0
        ? 'Jornal'
        : r.condicionLiquidacion === 1
          ? 'Mensual'
          : r.condicionLiquidacion,
  },
  {
    field: 'importe',
    width: 160,
    header: 'Importe de referencia',
    getValue: (r) => r.escalaInicial?.importe ?? r.importe ?? 'Sin importe',
  },
  {
    field: 'estado',
    width: 150,
    header: 'Escala',
    getValue: (r) =>
      r.historia
        ? 'Con historial'
        : r.escalaInicial
          ? 'Inicial en borrador'
          : 'Sin escala',
  },
];
export const convenioLabels = {
  codigo: 'Código',
  nombre: 'Nombre',
  descripcion: 'Descripción',
} as const;
export function ConvenioFormSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando formulario de convenio"
      className="convenio-form"
    >
      <div className="convenio-root" aria-hidden="true">
        {Object.entries(convenioLabels).map(([key, label]) => (
          <div key={key} className={`convenio-entry-${key} field`}>
            <label>{label}</label>
            <Skeleton height="var(--convenio-control-height)" />
          </div>
        ))}
      </div>
      <DataGridSkeleton columns={4} actions />
    </div>
  );
}
export function ConvenioForm({
  initial,
  busy,
  readOnly,
  canDelete,
  onSubmit,
}: {
  initial?: ConvenioCompleto;
  busy: boolean;
  readOnly: boolean;
  canDelete: boolean;
  onSubmit: (
    data: ConvenioWrite,
    destination: SaveDestination,
  ) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConvenioFields>({
    resolver: zodResolver(convenioSchema),
    defaultValues: convenioFields(initial),
  });
  const [rows, setRows] = useState<Row[]>(
    () =>
      initial?.categorias.map((c) => {
        const { idConvenio: _, ...data } = c.categoria;
        return {
          ...data,
          key: `saved-${data.id}`,
          historia: c.tieneHistoria,
          importe: c.escala?.version.importe ?? null,
        };
      }) ?? [],
  );
  const [removed, setRemoved] = useState<number[]>([]);
  const [child, setChild] = useState<{ row?: Row; readOnly?: boolean } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<Row | null>(null);
  const disabled = busy || readOnly;
  return (
    <>
      <form
        id="convenio-form"
        className="convenio-form"
        noValidate
        onSubmit={(event) => {
          if (disabled || child || deleting) {
            event.preventDefault();
            return;
          }
          const destination = getSaveDestination(
            (event.nativeEvent as SubmitEvent).submitter,
          );
          void handleSubmit((v) =>
            onSubmit(
              toWrite(
                v,
                rows.map(
                  ({ key: _, historia: __, importe: ___, ...data }) => data,
                ),
                removed,
                initial,
              ),
              destination,
            ),
          )(event);
        }}
      >
        <fieldset disabled={busy} className="convenio-fieldset convenio-root">
          {(Object.keys(convenioLabels) as (keyof ConvenioFields)[]).map(
            (key) => (
              <div key={key} className={`convenio-entry-${key}`}>
                <Input
                  label={convenioLabels[key]}
                  {...register(key)}
                  readOnly={readOnly}
                  error={errors[key]?.message}
                />
              </div>
            ),
          )}
        </fieldset>
        <div className="convenio-categorias">
          <DataGrid
            label="Categorías del convenio"
            rows={rows}
            columns={columns}
            getRowId={(r) => r.key}
            rowHeight={48}
            initialState={{ pagination: { page: 0, pageSize: 25 } }}
            pageSizeOptions={[10, 25, 50, 100]}
            emptyMessage="No hay categorías agregadas."
            globalActions={[
              {
                id: 'add',
                label: 'Agregar categoría',
                visible: !readOnly,
                disabled: busy,
                onClick: () => setChild({}),
              },
            ]}
            rowActions={[
              {
                id: 'view',
                label: 'Ver categoría',
                icon: <Icon name="eye" />,
                display: 'icon',
                onClick: (row) => setChild({ row, readOnly: true }),
              },
              {
                id: 'edit',
                label: 'Editar categoría',
                icon: <Icon name="edit" />,
                display: 'icon',
                visible: () => !readOnly,
                disabled: () => busy,
                onClick: (row) => setChild({ row }),
              },
              {
                id: 'remove',
                label: 'Quitar categoría',
                icon: <Icon name="close" />,
                display: 'icon',
                visible: (r) => !readOnly && (r.id === null || canDelete),
                disabled: (r) => busy || r.historia,
                onClick: setDeleting,
              },
            ]}
          />
        </div>
        <p className="field-note">
          {initial
            ? `Importes de referencia del período ${initial.periodo.slice(0, 2)}/${initial.periodo.slice(2)}. Las escalas e historial se consultan desde la acción Escalas del listado.`
            : 'Podés agregar categorías con o sin escala inicial.'}{' '}
          Las categorías con historial no pueden eliminarse.
        </p>
      </form>
      {child && (
        <CategoriaEditor
          initial={child.row}
          readOnly={child.readOnly}
          onClose={() => setChild(null)}
          onApply={(value) => {
            if (disabled || child.readOnly) return;
            setRows((current) =>
              child.row
                ? current.map((r) =>
                    r.key === child.row!.key ? { ...r, ...value } : r,
                  )
                : [
                    ...current,
                    {
                      ...value,
                      key: crypto.randomUUID(),
                      historia: false,
                      importe: null,
                    },
                  ],
            );
            setChild(null);
          }}
        />
      )}
      <Modal
        open={deleting !== null}
        title="Quitar categoría"
        onClose={() => setDeleting(null)}
        acceptButton={{ label: 'Quitar' }}
        onAccept={() => {
          if (
            !deleting ||
            deleting.historia ||
            disabled ||
            (deleting.id !== null && !canDelete)
          )
            return;
          setRows((r) => r.filter((x) => x.key !== deleting.key));
          if (deleting.id !== null) setRemoved((r) => [...r, deleting.id!]);
          setDeleting(null);
        }}
      >
        <p>
          ¿Quitás {deleting?.descripcion || 'esta categoría'} del convenio? La
          baja se aplicará al guardar.
        </p>
      </Modal>
    </>
  );
}
