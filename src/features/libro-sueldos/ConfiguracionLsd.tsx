import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import {
  FormDialogActions,
  type SaveDestination,
} from '@/components/ui/Modal/FormDialogActions';
import { DataGrid } from '@/components/ui/DataGrid';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/services/http/ApiError';
import { RecordForm, RecordSkeleton, type FieldSpec } from './RecordForm';
import { libroService } from './service';
import type { Asignacion, Concepto, Referencias } from './types';

type Editor =
  | { kind: 'concepto'; value: Concepto }
  | { kind: 'asignacion'; value: Asignacion };
const conceptoFields: FieldSpec[] = [
  {
    name: 'codigoEmpleador',
    label: 'Código del empleador',
    kind: 'text',
    required: true,
  },
  { name: 'descripcion', label: 'Descripción', kind: 'text', required: true },
  { name: 'codigoArca', label: 'Clasificación ARCA', kind: 'text' },
  { name: 'activo', label: 'Activo', kind: 'boolean' },
];
const asignacionFields: FieldSpec[] = [
  {
    name: 'idFormula',
    label: 'Fórmula',
    kind: 'select',
    lookup: 'formulas',
    required: true,
  },
  {
    name: 'idConceptoEmpresa',
    label: 'Concepto del empleador',
    kind: 'select',
    lookup: 'conceptosLsd',
    required: true,
  },
  {
    name: 'periodoDesde',
    label: 'Desde (AAAAMM)',
    kind: 'integer',
    required: true,
  },
  { name: 'periodoHasta', label: 'Hasta (AAAAMM)', kind: 'integer' },
];
export function ConfiguracionLsd({
  open,
  onClose,
  empresaInicial,
  canWrite,
  referencias,
}: {
  open: boolean;
  onClose: () => void;
  empresaInicial?: number;
  canWrite: boolean;
  referencias?: Referencias;
}) {
  const client = useQueryClient();
  const [empresa, setEmpresa] = useState<number | undefined>(empresaInicial);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [undoLoading, setUndoLoading] = useState(false);
  const [undoError, setUndoError] = useState<unknown>(null);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    if (open) {
      setEmpresa(empresaInicial);
      setFeedback('');
    }
  }, [open, empresaInicial]);
  const config = useQuery({
    queryKey: ['libro-sueldos', 'configuracion', empresa],
    queryFn: ({ signal }) => libroService.configuracion(empresa!, signal),
    enabled: open && Boolean(empresa),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const save = useMutation({
    mutationFn: async (request: Editor) =>
      request.kind === 'concepto'
        ? libroService.concepto(empresa!, request.value)
        : libroService.asignacion(empresa!, request.value),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ['libro-sueldos', 'configuracion', empresa],
      });
    },
  });
  const nuevo = (kind: Editor['kind']): Editor =>
    kind === 'concepto'
      ? {
          kind,
          value: {
            id: 0,
            idEmpresa: empresa!,
            codigoEmpleador: '',
            descripcion: '',
            codigoArca: null,
            activo: true,
            version: 0,
          },
        }
      : {
          kind,
          value: {
            id: 0,
            idConceptoEmpresa: 0,
            idFormula: 0,
            periodoDesde: 0,
            periodoHasta: null,
            version: 0,
          },
        };
  const show = (value: Editor, view = false) => {
    save.reset();
    setUndoError(null);
    setFeedback('');
    setReadOnly(view);
    setFormVersion((v) => v + 1);
    setEditor(value);
  };
  const submit = async (request: Editor, destination: SaveDestination) => {
    if (!canWrite || save.isPending) return;
    try {
      const result = await save.mutateAsync(request);
      setFeedback('La configuración se guardó correctamente.');
      setFormVersion((v) => v + 1);
      if (destination === 'close') setEditor(null);
      else if (destination === 'new') setEditor(nuevo(request.kind));
      else
        setEditor(
          'codigoEmpleador' in result
            ? { kind: 'concepto', value: result }
            : { kind: 'asignacion', value: result },
        );
    } catch {
      /* Keep draft and show the reviewed API error. */
    }
  };
  const opciones = {
    ...referencias?.opciones,
    conceptosLsd:
      config.data?.conceptos.map((c) => ({
        id: c.id,
        nombre: c.descripcion,
        codigo: c.codigoEmpleador,
      })) ?? [],
  };
  const undo = async () => {
    save.reset();
    setFeedback('');
    setUndoError(null);
    setFormVersion((v) => v + 1);
    if (!editor) return;
    if (!editor.value.id) {
      setEditor(nuevo(editor.kind));
      return;
    }
    const expected = editor;
    setUndoLoading(true);
    const result = await config.refetch();
    if (result.isError) setUndoError(result.error);
    else
      setEditor((current) => {
        if (
          !current ||
          current.kind !== expected.kind ||
          current.value.id !== expected.value.id
        )
          return current;
        if (expected.kind === 'concepto') {
          const value = result.data?.conceptos.find(
            (x) => x.id === expected.value.id,
          );
          return value ? { kind: 'concepto', value } : current;
        }
        const value = result.data?.asignaciones.find(
          (x) => x.id === expected.value.id,
        );
        return value ? { kind: 'asignacion', value } : current;
      });
    setUndoLoading(false);
  };
  return (
    <>
      <Modal
        open={open}
        title="Configuración de conceptos LSD"
        size="large"
        onClose={() => {
          if (!save.isPending && !editor) onClose();
        }}
        closeDisabled={save.isPending || Boolean(editor)}
        cancelButton={{
          label: 'Cerrar',
          disabled: save.isPending || Boolean(editor),
        }}
        acceptButton={false}
      >
        <div className="lsd-config">
          <div className="lsd-entry">
            <div className="field">
              <label htmlFor="lsd-config-empresa">Empresa</label>
              <Select
                id="lsd-config-empresa"
                value={empresa ?? ''}
                onChange={(e) =>
                  setEmpresa(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              >
                <option value="">Seleccioná una empresa</option>
                {referencias?.opciones.empresas?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="field-note">
            Si una fórmula no tiene código empresarial configurado, se utiliza
            su código interno. Esta configuración no registra conceptos en ARCA.
          </p>
          {!empresa && (
            <p>
              Seleccioná la empresa para consultar sus conceptos y asignaciones.
            </p>
          )}
          {empresa && (
            <>
              <DataGrid
                label="Conceptos de la empresa"
                rows={config.data?.conceptos ?? []}
                getRowId={(r) => r.id}
                rowHeight={48}
                loading={config.isFetching}
                error={config.isError ? errorMessage(config.error) : null}
                onRetry={() => void config.refetch()}
                emptyMessage="No hay códigos empresariales configurados. Se usará el código interno de cada fórmula."
                columns={[
                  {
                    field: 'codigo',
                    header: 'Código del empleador',
                    getValue: (r) => r.codigoEmpleador,
                  },
                  {
                    field: 'descripcion',
                    header: 'Descripción',
                    getValue: (r) => r.descripcion,
                  },
                  {
                    field: 'arca',
                    header: 'Clasificación ARCA',
                    getValue: (r) => r.codigoArca,
                  },
                  {
                    field: 'activo',
                    header: 'Activo',
                    type: 'boolean',
                    getValue: (r) => r.activo,
                  },
                ]}
                globalActions={[
                  {
                    id: 'refresh',
                    label: 'Refrescar',
                    disabled: config.isFetching,
                    onClick: () => void config.refetch(),
                  },
                  {
                    id: 'new',
                    label: 'Nuevo concepto',
                    visible: canWrite,
                    onClick: () => show(nuevo('concepto')),
                  },
                ]}
                rowActions={[
                  {
                    id: 'view',
                    label: 'Ver',
                    onClick: (r) => show({ kind: 'concepto', value: r }, true),
                  },
                  {
                    id: 'edit',
                    label: 'Editar',
                    visible: () => canWrite,
                    onClick: (r) => show({ kind: 'concepto', value: r }),
                  },
                ]}
              />
              <DataGrid
                label="Asignaciones de fórmulas"
                rows={config.data?.asignaciones ?? []}
                getRowId={(r) => r.id}
                rowHeight={48}
                loading={config.isFetching}
                emptyMessage="No hay asignaciones. Los códigos de fórmula funcionan como respaldo."
                columns={[
                  {
                    field: 'formula',
                    header: 'Fórmula',
                    getValue: (r) =>
                      referencias?.opciones.formulas?.find(
                        (f) => f.id === r.idFormula,
                      )?.nombre ?? r.idFormula,
                  },
                  {
                    field: 'codigo',
                    header: 'Código del empleador',
                    getValue: (r) =>
                      config.data?.conceptos.find(
                        (c) => c.id === r.idConceptoEmpresa,
                      )?.codigoEmpleador,
                  },
                  {
                    field: 'desde',
                    header: 'Desde',
                    getValue: (r) => r.periodoDesde,
                  },
                  {
                    field: 'hasta',
                    header: 'Hasta',
                    getValue: (r) => r.periodoHasta,
                  },
                ]}
                globalActions={[
                  {
                    id: 'new',
                    label: 'Nueva asignación',
                    visible: canWrite,
                    disabled: !config.data?.conceptos.some((c) => c.activo),
                    onClick: () => show(nuevo('asignacion')),
                  },
                ]}
                rowActions={[
                  {
                    id: 'view',
                    label: 'Ver',
                    onClick: (r) =>
                      show({ kind: 'asignacion', value: r }, true),
                  },
                  {
                    id: 'edit',
                    label: 'Editar',
                    visible: () => canWrite,
                    onClick: (r) => show({ kind: 'asignacion', value: r }),
                  },
                ]}
              />
            </>
          )}
          {feedback && !editor && <p role="status">{feedback}</p>}
        </div>
      </Modal>
      <Modal
        open={editor !== null}
        title={
          (readOnly
            ? 'Ver '
            : editor?.value.id
              ? 'Editar '
              : editor?.kind === 'concepto'
                ? 'Nuevo '
                : 'Nueva ') +
          (editor?.kind === 'concepto'
            ? 'concepto del empleador'
            : 'asignación de fórmula')
        }
        onClose={() => {
          if (!save.isPending) setEditor(null);
        }}
        closeDisabled={save.isPending}
        cancelButton={{
          label: readOnly ? 'Cerrar' : 'Cancelar',
          disabled: save.isPending,
        }}
        acceptButton={
          readOnly
            ? false
            : {
                label: 'Guardar y cerrar',
                type: 'submit',
                form: 'lsd-config-form',
                loading: save.isPending,
                disabled: undoLoading || Boolean(undoError),
              }
        }
        actions={
          !readOnly && (
            <FormDialogActions
              form="lsd-config-form"
              busy={save.isPending}
              loading={undoLoading}
              hasError={Boolean(undoError)}
              onUndo={() => void undo()}
            />
          )
        }
      >
        {feedback && <p role="status">{feedback}</p>}
        {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
        {undoError != null && (
          <>
            <Notice>{errorMessage(undoError)}</Notice>
            <Button onClick={() => void undo()}>Reintentar datos</Button>
          </>
        )}
        {undoLoading && (
          <RecordSkeleton
            fields={
              editor?.kind === 'concepto' ? conceptoFields : asignacionFields
            }
          />
        )}
        {!undoLoading && editor?.kind === 'concepto' && (
          <RecordForm
            key={formVersion}
            id="lsd-config-form"
            fields={conceptoFields}
            initial={editor.value}
            busy={save.isPending}
            readOnly={readOnly}
            error={save.error}
            onSubmit={(value, destination) =>
              submit({ kind: 'concepto', value }, destination)
            }
          />
        )}
        {!undoLoading && editor?.kind === 'asignacion' && (
          <RecordForm
            key={formVersion}
            id="lsd-config-form"
            fields={asignacionFields}
            initial={editor.value}
            opciones={opciones}
            busy={save.isPending}
            readOnly={readOnly}
            error={save.error}
            onSubmit={(value, destination) =>
              submit({ kind: 'asignacion', value }, destination)
            }
          />
        )}
      </Modal>
    </>
  );
}
