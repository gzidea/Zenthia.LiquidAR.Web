import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/services/http/ApiError';
import { authService } from '../services/authService';

export function LogoutButton({ sidebar = false }: { sidebar?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await authService.logout();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="logout-control">
      <Button
        variant="ghost"
        className={sidebar ? 'sidebar-link' : undefined}
        busy={busy}
        onClick={() => void logout()}
      >
        <span className={sidebar ? 'sidebar-label' : undefined}>
          {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </span>
        <svg
          className="logout-icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M9 4H4v16h5M9 12h12m-5-5 5 5-5 5" />
        </svg>
      </Button>
      {error && <Notice>{error}</Notice>}
    </div>
  );
}
