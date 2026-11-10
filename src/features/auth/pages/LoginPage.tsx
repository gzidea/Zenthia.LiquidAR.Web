import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { config } from '@/lib/config';
import { errorMessage } from '@/services/http/ApiError';
import { AuthCard } from '../components/AuthCard';
import { loginSchema, type LoginFields } from '../schemas/authSchemas';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';

export function LoginPage() {
  const session = useAuthStore((state) => state.session);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: { userName: '', password: '' },
  });
  async function submit(values: LoginFields) {
    setError(null);
    try {
      await authService.login(values);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      resetField('password');
    }
  }
  return (
    <AuthCard
      badge="ACCESO A TU CUENTA"
      kicker="Bienvenido a LiquidAR"
      title="Ingresá a tu espacio"
      subtitle="Usá tu usuario o email y tu contraseña para continuar."
    >
      {session.status === 'anonymous' && session.reason === 'expired' && (
        <Notice tone="info">Tu sesión venció. Iniciá sesión nuevamente.</Notice>
      )}
      {session.status === 'anonymous' && session.reason === 'logout' && (
        <Notice tone="success">Cerraste sesión correctamente.</Notice>
      )}
      {config.error && <Notice>{config.error}</Notice>}
      <form noValidate onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}>
        <fieldset disabled={isSubmitting || Boolean(config.error)}>
          <Input
            label="Usuario o email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Tu usuario o email"
            {...register('userName')}
            error={errors.userName?.message}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="Ingresá tu contraseña"
            {...register('password')}
            error={errors.password?.message}
          />
          {error && <Notice>{error}</Notice>}
          <Button type="submit" busy={isSubmitting}>
            {isSubmitting ? 'Verificando…' : 'Ingresar →'}
          </Button>
        </fieldset>
      </form>
      <p className="card-footnote">
        ¿Es tu primer ingreso? Usá la clave temporal que recibiste por correo.
      </p>
    </AuthCard>
  );
}
