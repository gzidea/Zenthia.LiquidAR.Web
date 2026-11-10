import { Link, useLocation } from 'react-router-dom';
import { Notice } from '@/components/ui/Notice';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
export function HomePage() {
  const session = useAuthStore((state) => state.session);
  const profile = usePermissions();
  const displayName =
    profile.data?.displayName ||
    ('user' in session ? session.user.userName : '');
  const location = useLocation();
  const state: unknown = location.state;
  const changed =
    state !== null &&
    typeof state === 'object' &&
    'passwordChanged' in state &&
    state.passwordChanged === true;
  return (
    <>
      <p className="kicker">Inicio / Tu cuenta</p>
      <h1 tabIndex={-1}>Hola, {displayName}.</h1>
      <p className="subtitle">Bienvenido a Zenthia.LiquidAR.Web.</p>
      {changed && (
        <Notice tone="success">
          Tu contraseña se actualizó correctamente.
        </Notice>
      )}
      <section className="home-card" aria-labelledby="welcome-title">
        <span className="home-stamp" aria-hidden="true">
          ✓
        </span>
        <p className="kicker">Todo listo</p>
        <h2 id="welcome-title">Este es tu espacio de trabajo</h2>
        <p>
          Ingresaste correctamente. Las herramientas de LiquidAR se incorporarán
          acá a medida que estén disponibles.
        </p>
        <Link className="text-link" to="/change-password">
          Cambiar mi contraseña →
        </Link>
      </section>
    </>
  );
}
