import { Select } from '@/components/ui/Select';
import { StrictMode, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/fraunces/600.css';
import '@/styles/theme.css';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { Modal, type ModalCloseReason } from '..';

type Example = 'standard' | 'form' | 'custom' | 'info' | 'long' | 'nested';
const titles: Record<Example, string> = {
  standard: 'Confirmar operación',
  form: 'Formulario de ejemplo',
  custom: 'Footer personalizado',
  info: 'Información',
  long: 'Contenido extenso',
  nested: 'Modal principal',
};
function Demo() {
  const [open, setOpen] = useState(false);
  const [example, setExample] = useState<Example>('standard');
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [buttonRadius, setButtonRadius] = useState(2);
  const [fullWidth, setFullWidth] = useState(false);
  const [disableEscape, setDisableEscape] = useState(false);
  const [disableBackdrop, setDisableBackdrop] = useState(false);
  const [child, setChild] = useState(false);
  const [label, setLabel] = useState('Ejemplo');
  const [saving, setSaving] = useState(false);
  const [fail, setFail] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('Ninguna acción ejecutada.');
  const input = useRef<HTMLInputElement>(null);

  function show(next: Example) {
    setExample(next);
    setError('');
    setFail(false);
    setOpen(true);
  }
  function close(reason: ModalCloseReason) {
    setOpen(false);
    setResult(`Cierre: ${reason}`);
  }
  async function accept() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      // Local simulation only; consumer owns both async state and errors.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));
      if (fail) throw new Error('Simulación de error');
      setResult(`Operación completada: ${label}`);
      setOpen(false);
    } catch {
      setError('No se pudo completar la operación. Podés reintentar.');
    } finally {
      setSaving(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void accept();
  }

  return (
    <main style={{ padding: 'var(--space-5)', maxWidth: 1100, margin: 'auto' }}>
      <h1>Modal reutilizable</h1>
      <p>
        Ejemplos con datos ficticios, sin servicios ni dependencias adicionales.
      </p>
      <p role="status" style={{ marginBlock: 'var(--space-4)' }}>
        {result}
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <label>
          Tamaño{' '}
          <Select
            value={size}
            onChange={(e) => setSize(e.target.value as typeof size)}
          >
            <option value="small">Pequeño</option>
            <option value="medium">Mediano</option>
            <option value="large">Grande</option>
          </Select>
        </label>
        <label>
          Radio de botones{' '}
          <Select
            value={buttonRadius}
            onChange={(event) => setButtonRadius(Number(event.target.value))}
          >
            <option value={0}>0 px</option>
            <option value={2}>Tema (2 px)</option>
            <option value={8}>8 px</option>
            <option value={999}>Píldora</option>
          </Select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={fullWidth}
            onChange={(e) => setFullWidth(e.target.checked)}
          />{' '}
          Ancho completo
        </label>
        <label>
          <input
            type="checkbox"
            checked={disableEscape}
            onChange={(e) => setDisableEscape(e.target.checked)}
          />{' '}
          Bloquear Escape
        </label>
        <label>
          <input
            type="checkbox"
            checked={disableBackdrop}
            onChange={(e) => setDisableBackdrop(e.target.checked)}
          />{' '}
          Bloquear fondo
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        {(Object.keys(titles) as Example[]).map((key) => (
          <Button key={key} style={{ width: 'auto' }} onClick={() => show(key)}>
            {titles[key]}
          </Button>
        ))}
      </div>
      <div style={{ marginTop: 'var(--space-6)' }}>
        <h2>Comportamiento</h2>
        <p>
          El consumidor controla apertura, guardado y errores. Escape, Cancelar
          y la cruz solicitan cerrar. En el ejemplo largo, el contenido se
          desplaza manteniendo las acciones visibles.
        </p>
      </div>

      <Modal
        open={open}
        title={example === 'info' ? undefined : titles[example]}
        titleIcon={
          example === 'form' ? <Icon name="edit" /> : <Icon name="eye" />
        }
        subtitle={
          example === 'form' ? 'Completá los datos del ejemplo.' : undefined
        }
        ariaLabel={titles[example]}
        onClose={close}
        size={size}
        fullWidth={fullWidth}
        disableEscapeClose={disableEscape}
        disableBackdropClose={disableBackdrop}
        closeDisabled={saving}
        initialFocusRef={example === 'form' ? input : undefined}
        onAccept={example === 'standard' ? accept : undefined}
        acceptButton={
          example === 'form'
            ? {
                label: 'Guardar',
                radius: buttonRadius,
                type: 'submit',
                form: 'modal-demo-form',
                loading: saving,
                loadingLabel: 'Guardando…',
                icon: <Icon name="plus" />,
              }
            : example === 'standard'
              ? { loading: saving, radius: buttonRadius }
              : false
        }
        cancelButton={{ radius: buttonRadius }}
        actions={
          example === 'form' ? (
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setLabel('')}
            >
              Restablecer
            </Button>
          ) : undefined
        }
        footer={
          example === 'info'
            ? null
            : example === 'custom'
              ? {
                  type: 'custom',
                  content: (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>Contenido React arbitrario.</span>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setResult('Acción personalizada ejecutada')
                        }
                      >
                        Acción propia
                      </Button>
                      <Button onClick={() => setOpen(false)}>Listo</Button>
                    </div>
                  ),
                }
              : { type: 'standard' }
        }
      >
        {example === 'form' ? (
          <form id="modal-demo-form" onSubmit={submit}>
            <fieldset disabled={saving}>
              <Input
                ref={input}
                label="Etiqueta"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
              <label>
                <input
                  type="checkbox"
                  checked={fail}
                  onChange={(e) => setFail(e.target.checked)}
                />{' '}
                Simular error
              </label>
            </fieldset>
          </form>
        ) : example === 'long' ? (
          <div>
            {Array.from({ length: 35 }, (_, i) => (
              <p key={i} style={{ marginBottom: 'var(--space-4)' }}>
                Párrafo {i + 1}. Este contenido de ejemplo permite comprobar el
                desplazamiento independiente del cuerpo y la disponibilidad del
                título y las acciones en pantallas pequeñas.
              </p>
            ))}
            <Button
              variant="ghost"
              onClick={() => setResult('Fin del contenido')}
            >
              Acción al final
            </Button>
          </div>
        ) : example === 'nested' ? (
          <>
            <p>El segundo modal conserva el bloqueo de scroll del primero.</p>
            <Button onClick={() => setChild(true)}>Abrir segundo modal</Button>
          </>
        ) : (
          <p>
            {example === 'standard'
              ? '¿Deseás continuar con esta operación de ejemplo?'
              : 'El body puede contener cualquier árbol de componentes React.'}
          </p>
        )}
        {error && <Notice>{error}</Notice>}
      </Modal>
      <Modal
        open={child}
        title="Segundo modal"
        onClose={() => setChild(false)}
        size="small"
      >
        <p>Al cerrar, el foco vuelve al botón del modal principal.</p>
      </Modal>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
