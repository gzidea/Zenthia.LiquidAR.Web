import { Link } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { LogoutButton } from '../components/LogoutButton';
import { StepFolio } from '../components/StepFolio';
export function FirstLoginPage() {
  return (
    <>
      <StepFolio current={1} />
      <AuthCard
        badge="PRIMER INGRESO"
        kicker="Un paso antes de empezar"
        title="Te damos la bienvenida"
        subtitle="Ingresaste con una clave temporal. Elegí una contraseña propia para empezar a usar LiquidAR."
      >
        <div className="welcome-note">
          <span aria-hidden="true">01 /</span>
          <p>
            Tu cuenta ya está lista.
            <br />
            Ahora vamos a actualizar tu contraseña.
          </p>
        </div>
        <Link className="button button-primary" to="/change-password">
          Elegir mi contraseña →
        </Link>
        <LogoutButton />
      </AuthCard>
    </>
  );
}
