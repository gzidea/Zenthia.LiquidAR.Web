import { StrictMode, useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import {
  FormSkeleton,
  Skeleton,
  SkeletonActions,
} from '@/components/ui/Skeleton';
import { Modal } from './Modal';
import { lockPageScroll } from './scrollLock';

// jsdom lacks the native dialog API. This adapter only synchronizes open;
// top-layer modality, focus containment and native cancel are tested in Chrome.
const originalShow = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
);
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open');
    },
  });
});
afterAll(() => {
  for (const [key, descriptor] of [
    ['showModal', originalShow],
    ['close', originalClose],
  ] as const) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});
function backdrop(dialog: HTMLElement) {
  fireEvent.pointerDown(dialog, { clientX: -10, clientY: -10 });
  // jsdom PointerEvent does not expose coordinates in all versions.
  fireEvent(
    dialog,
    new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: -10,
      clientY: -10,
    }),
  );
  fireEvent.click(dialog, { clientX: -10, clientY: -10 });
}

describe('Modal', () => {
  it('compone skeleton en título, cuerpo y footer sin interferir con el cierre', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal
        open
        title={
          <>
            <span>Formulario</span>
            <Skeleton />
          </>
        }
        onClose={onClose}
        footer={{ type: 'custom', content: <SkeletonActions /> }}
      >
        <FormSkeleton fields={3} actions={false} />
      </Modal>,
    );
    expect(
      screen.getByRole('dialog', { name: 'Formulario' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar modal' }));
    expect(onClose).toHaveBeenCalledWith('close-button');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(
      <Modal open={false} title="Formulario" onClose={onClose}>
        <FormSkeleton />
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('solo abre con open y renderiza título React, body complejo y footer estándar', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open={false} title="Ejemplo" onClose={onClose}>
        Contenido
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(
      <Modal
        open
        title={
          <span>
            <Icon name="edit" />
            Ejemplo
          </span>
        }
        onClose={onClose}
        onAccept={vi.fn()}
        ariaDescribedBy="description"
      >
        <p id="description">Descripción</p>
        <section>
          <label>
            Nombre
            <input />
          </label>
        </section>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Ejemplo' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Descripción');
    expect(screen.getByLabelText('Nombre')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeVisible();
  });
  it('sin título usa nombre accesible, no crea header y puede ocultar footer/cierre', () => {
    render(
      <Modal
        open
        ariaLabel="Información"
        onClose={vi.fn()}
        showCloseButton={false}
        footer={null}
      >
        <p>Texto</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Información' });
    expect(dialog.querySelector('header')).toBeNull();
    expect(dialog.querySelector('footer')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(dialog.querySelector('.modal-body')).toHaveFocus();
  });
  it('sin título conserva botón de cierre sin header vacío', async () => {
    const close = vi.fn();
    render(
      <Modal open ariaLabel="Información" onClose={close} footer={null}>
        Texto
      </Modal>,
    );
    expect(screen.getByRole('dialog').querySelector('header')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar modal' }));
    expect(close).toHaveBeenCalledWith('close-button');
  });
  it('solicita cancelar y espera que el consumidor cierre', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal
        open
        title="Ejemplo"
        onClose={onClose}
        cancelButton={{ label: 'Volver' }}
      >
        Texto
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onClose).toHaveBeenCalledWith('cancel');
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    rerender(<Modal open={false} title="Ejemplo" onClose={onClose} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('onCancel reemplaza la solicitud de cierre predeterminada', async () => {
    const onClose = vi.fn(),
      onCancel = vi.fn();
    render(
      <Modal open title="Ejemplo" onClose={onClose} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
  it('Aceptar ejecuta callback y no cierra automáticamente', async () => {
    const onClose = vi.fn(),
      onAccept = vi.fn();
    render(
      <Modal
        open
        title="Ejemplo"
        onClose={onClose}
        onAccept={onAccept}
        acceptButton={{ label: 'Guardar' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });
  it('respeta disabled, loading, iconos y estados configurados de los botones', async () => {
    const accept = vi.fn(),
      cancel = vi.fn();
    const { rerender } = render(
      <Modal
        open
        title="Ejemplo"
        onClose={vi.fn()}
        onAccept={accept}
        onCancel={cancel}
        acceptButton={{
          label: 'Guardar',
          loading: true,
          loadingLabel: 'Guardando…',
          icon: <Icon name="plus" />,
        }}
        cancelButton={{ disabled: true }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Guardando…');
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(accept).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    rerender(
      <Modal
        open
        title="Ejemplo"
        onClose={vi.fn()}
        onAccept={accept}
        acceptButton={{ disabled: true }}
        cancelButton={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Cancelar' }),
    ).not.toBeInTheDocument();
  });
  it.each(['text', 'icon', 'icon-text'] as const)(
    'botón estándar con presentación %s mantiene nombre accesible',
    (display) => {
      render(
        <Modal
          open
          title="Ejemplo"
          onClose={vi.fn()}
          acceptButton={{
            label: 'Guardar',
            icon: <Icon name="plus" />,
            display,
          }}
        />,
      );
      const button = screen.getByRole('button', { name: 'Guardar' });
      expect(Boolean(button.querySelector('svg'))).toBe(display !== 'text');
      expect(button.textContent).toBe(display === 'icon' ? '' : 'Guardar');
      if (display === 'icon')
        expect(button).toHaveAttribute('title', 'Guardar');
    },
  );
  it('footer personalizado reemplaza completamente acciones estándar', async () => {
    const reset = vi.fn();
    render(
      <Modal
        open
        title="Opciones"
        onClose={vi.fn()}
        onAccept={vi.fn()}
        actions={<p>No mostrar</p>}
        footer={{
          type: 'custom',
          content: (
            <section>
              <p>Ayuda</p>
              <Button onClick={reset}>Restablecer</Button>
            </section>
          ),
        }}
      >
        Contenido
      </Modal>,
    );
    expect(screen.getByText('Ayuda')).toBeVisible();
    expect(screen.queryByText('No mostrar')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Aceptar' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancelar' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(reset).toHaveBeenCalledOnce();
  });
  it('acciones adicionales conviven con el footer estándar', async () => {
    const action = vi.fn();
    render(
      <Modal
        open
        title="Ejemplo"
        onClose={vi.fn()}
        acceptButton
        footer={{ type: 'standard' }}
        actions={<Button onClick={action}>Acción adicional</Button>}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Acción adicional' }),
    );
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeVisible();
  });
  it('omite footer estándar sin acciones y footer personalizado nulo', () => {
    const { rerender } = render(
      <Modal
        open
        title="Ejemplo"
        onClose={vi.fn()}
        cancelButton={false}
        acceptButton={false}
      />,
    );
    expect(screen.getByRole('dialog').querySelector('footer')).toBeNull();
    rerender(
      <Modal
        open
        title="Ejemplo"
        onClose={vi.fn()}
        footer={{ type: 'custom', content: null }}
      />,
    );
    expect(screen.getByRole('dialog').querySelector('footer')).toBeNull();
  });
  it('Escape solicita cierre y respeta bloqueo específico', () => {
    const close = vi.fn();
    const { rerender } = render(<Modal open title="Ejemplo" onClose={close} />);
    expect(
      fireEvent(
        screen.getByRole('dialog'),
        new Event('cancel', { cancelable: true }),
      ),
    ).toBe(false);
    expect(close).toHaveBeenCalledWith('escape');
    close.mockClear();
    rerender(<Modal open title="Ejemplo" onClose={close} disableEscapeClose />);
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );
    expect(close).not.toHaveBeenCalled();
  });
  it('backdrop cierra solo si el gesto comienza fuera; no al clicar contenido', () => {
    const close = vi.fn();
    const { rerender } = render(
      <Modal open title="Ejemplo" onClose={close}>
        <p>Interior</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText('Interior'));
    fireEvent.pointerDown(screen.getByText('Interior'));
    fireEvent.click(screen.getByRole('dialog'), { clientX: -10, clientY: -10 });
    expect(close).not.toHaveBeenCalled();
    backdrop(screen.getByRole('dialog'));
    expect(close).toHaveBeenCalledWith('backdrop');
    close.mockClear();
    rerender(
      <Modal open title="Ejemplo" onClose={close} disableBackdropClose />,
    );
    backdrop(screen.getByRole('dialog'));
    expect(close).not.toHaveBeenCalled();
  });
  it('closeDisabled bloquea todos los cierres del componente', async () => {
    const close = vi.fn(),
      cancel = vi.fn();
    render(
      <Modal
        open
        title="Ejemplo"
        onClose={close}
        onCancel={cancel}
        closeDisabled
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar modal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );
    backdrop(screen.getByRole('dialog'));
    expect(close).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
  it('reconcilia cierre nativo si el consumidor mantiene open', () => {
    const close = vi.fn();
    render(<Modal open title="Ejemplo" onClose={close} />);
    const dialog = screen.getByRole('dialog') as HTMLDialogElement;
    dialog.close();
    fireEvent(dialog, new Event('close'));
    expect(dialog).toHaveAttribute('open');
    expect(close).toHaveBeenCalledWith('native');
    fireEvent(dialog, new Event('close'));
    expect(close).toHaveBeenCalledOnce();
  });
  it('conecta submit del footer al formulario del body sin duplicar callback', async () => {
    const submit = vi.fn(),
      accept = vi.fn();
    render(
      <Modal
        open
        title="Formulario"
        onClose={vi.fn()}
        onAccept={accept}
        acceptButton={{ label: 'Guardar', type: 'submit', form: 'form-test' }}
      >
        <form
          id="form-test"
          onSubmit={(event) => {
            event.preventDefault();
            submit(new FormData(event.currentTarget).get('name'));
          }}
        >
          <label>
            Nombre
            <input name="name" defaultValue="Ejemplo" />
          </label>
        </form>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(submit).toHaveBeenCalledWith('Ejemplo');
    expect(accept).not.toHaveBeenCalled();
  });
  it('foco inicial configurable, retorno al disparador y scroll restaurado en StrictMode', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      const input = useRef<HTMLInputElement>(null);
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir</button>
          <Modal
            open={open}
            title="Ejemplo"
            onClose={() => setOpen(false)}
            initialFocusRef={input}
          >
            <input aria-label="Campo inicial" ref={input} />
          </Modal>
        </>
      );
    }
    document.body.style.overflow = 'auto';
    const { unmount } = render(
      <StrictMode>
        <Example />
      </StrictMode>,
    );
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(trigger);
    expect(screen.getByLabelText('Campo inicial')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('auto');
    await userEvent.click(trigger);
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.removeProperty('overflow');
  });
  it('locks anidados no desbloquean el scroll antes del último cierre', () => {
    document.documentElement.style.setProperty(
      'overflow',
      'scroll',
      'important',
    );
    const first = lockPageScroll(document),
      second = lockPageScroll(document);
    first();
    first();
    expect(document.documentElement.style.overflow).toBe('hidden');
    second();
    expect(document.documentElement.style.overflow).toBe('scroll');
    expect(document.documentElement.style.getPropertyPriority('overflow')).toBe(
      'important',
    );
    document.documentElement.style.removeProperty('overflow');
  });
  it.each([false, true])(
    'Aceptar async: estado y resultado los maneja consumidor (error=%s)',
    async (failure) => {
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const work = vi.fn(async () => {
        await pending;
        if (failure) throw new Error('Error de ejemplo');
      });
      function Example() {
        const [open, setOpen] = useState(true),
          [saving, setSaving] = useState(false),
          [error, setError] = useState('');
        async function save() {
          setSaving(true);
          try {
            await work();
            setOpen(false);
          } catch {
            setError('No se pudo guardar');
          } finally {
            setSaving(false);
          }
        }
        return (
          <Modal
            open={open}
            title="Async"
            onClose={() => setOpen(false)}
            onAccept={save}
            acceptButton={{ loading: saving }}
            closeDisabled={saving}
          >
            {error && <p role="alert">{error}</p>}
          </Modal>
        );
      }
      render(<Example />);
      await userEvent.dblClick(screen.getByRole('button', { name: 'Aceptar' }));
      expect(work).toHaveBeenCalledOnce();
      expect(screen.getByRole('status')).toHaveTextContent('Procesando');
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await act(async () => {
        finish();
        await pending;
      });
      if (failure) {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'No se pudo guardar',
        );
        expect(screen.getByRole('button', { name: 'Aceptar' })).toBeEnabled();
      } else expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );
});
