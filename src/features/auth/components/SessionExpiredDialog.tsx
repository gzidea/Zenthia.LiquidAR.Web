import { useId, useState } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/services/http/ApiError';
import { authService, expireSession } from '../services/authService';
import './sessionExpiredDialog.css';

export function SessionExpiredDialog({ seconds }: { seconds: number }) {
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resume() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await authService.resume();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'No pudimos retomar tu sesión. Probá de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      ariaLabel="Tu sesión está por cerrarse"
      className="session-expired-dialog"
      ariaDescribedBy={descriptionId}
      size="small"
      showCloseButton={false}
      disableEscapeClose
      disableBackdropClose
      closeDisabled
      onClose={() => {}}
      cancelButton={false}
      acceptButton={false}
      footer={null}
    >
      <div className="session-expired-content">
        <svg
          className="session-expired-clock"
          viewBox="0 0 96 96"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M48 7v12M40 7h16M73 17l8 8M22 22l-7 7" />
          <circle cx="48" cy="55" r="32" />
          <path d="M48 55l15-19" />
          <circle cx="48" cy="55" r="3" fill="currentColor" />
        </svg>
        <h2>Tu sesión está por cerrarse</h2>
        <p
          id={descriptionId}
          className="session-expired-countdown"
          role="timer"
          aria-live="off"
        >
          La sesión se cerrará en <strong>{seconds}</strong>{' '}
          {seconds === 1 ? 'segundo' : 'segundos'}.
        </p>
        {error && (
          <p className="session-expired-error" role="alert">
            {error}
          </p>
        )}
        <div className="session-expired-actions">
          <Button
            className="session-expired-extend"
            busy={busy}
            onClick={() => void resume()}
          >
            {busy ? 'Extendiendo…' : 'Extender la sesión'}
          </Button>
          <Button
            className="session-expired-close"
            variant="ghost"
            onClick={expireSession}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    </Modal>
  );
}
