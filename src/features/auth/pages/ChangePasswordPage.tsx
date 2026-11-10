import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/services/http/ApiError';
import { AuthCard } from '../components/AuthCard';
import { LogoutButton } from '../components/LogoutButton';
import { StepFolio } from '../components/StepFolio';
import { changePasswordSchema } from '../schemas/authSchemas';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import type { ChangePasswordRequest } from '../types/auth';

export function ChangePasswordPage() {
  const session = useAuthStore((state) => state.session);
  const mandatory = session.status === 'password-required';
  const firstLogin = 'user' in session && session.user.firstLogin && mandatory;
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });
  async function submit(values: ChangePasswordRequest) {
    setError(null);
    try {
      await authService.changePassword(values);
      navigate('/app', { replace: true, state: { passwordChanged: true } });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      reset();
    }
  }
  return (
    <>
      {firstLogin && <StepFolio current={2} />}
      <AuthCard
        badge={mandatory ? 'ACTUALIZACIÓN REQUERIDA' : 'TU CUENTA'}
        kicker={firstLogin ? 'Tu primer ingreso' : 'Seguridad de acceso'}
        title="Elegí tu contraseña"
        subtitle={
          mandatory
            ? 'Actualizá tu contraseña para continuar a la aplicación.'
            : 'Ingresá tu contraseña actual y elegí una nueva.'
        }
      >
        <form
          noValidate
          onSubmit={handleSubmit(submit)}
          aria-busy={isSubmitting}
        >
          <fieldset disabled={isSubmitting}>
            <Input
              label={firstLogin ? 'Contraseña temporal' : 'Contraseña actual'}
              type="password"
              autoComplete="current-password"
              {...register('currentPassword')}
              error={errors.currentPassword?.message}
            />
            <Input
              label="Contraseña nueva"
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
              error={errors.newPassword?.message}
            />
            <Input
              label="Confirmar contraseña"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
              hint="Volvé a escribir la nueva contraseña."
            />
            {error && <Notice>{error}</Notice>}
            <Button type="submit" busy={isSubmitting}>
              {isSubmitting ? 'Guardando…' : 'Guardar y entrar →'}
            </Button>
          </fieldset>
        </form>
        {!isSubmitting &&
          (mandatory ? (
            <LogoutButton />
          ) : (
            <Link className="button button-ghost" to="/app">
              Volver a la aplicación
            </Link>
          ))}
      </AuthCard>
    </>
  );
}
