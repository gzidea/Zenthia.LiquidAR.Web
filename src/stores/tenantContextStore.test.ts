import { beforeEach, expect, it } from 'vitest';
import { useTenantContextStore } from './tenantContextStore';
import { useEmpresaContextStore } from './empresaContextStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { loginResponse } from '@/test/fixtures';

beforeEach(() => {
  useEmpresaContextStore.setState({
    seleccionBloqueada: false,
    empresaSeleccionadaId: null,
  });
  useTenantContextStore.setState({ tenant: null, revision: 0 });
});
it('cambia solo el contexto de datos y limpia la empresa, también al volver a todos', () => {
  const identity = useAuthStore.getState();
  useEmpresaContextStore.getState().seleccionar(12);
  useTenantContextStore.getState().seleccionar({ id: 2, name: 'Cliente dos' });
  expect(useTenantContextStore.getState().tenant?.id).toBe(2);
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBeNull();
  expect(useAuthStore.getState()).toBe(identity);
  useEmpresaContextStore.getState().seleccionar(13);
  useTenantContextStore.getState().seleccionar(null);
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBeNull();
  expect(useTenantContextStore.getState().revision).toBe(2);
});
it('no cambia el contexto mientras una operación bloquea la selección', () => {
  useEmpresaContextStore.getState().bloquearSeleccion(true);
  useTenantContextStore.getState().seleccionar({ id: 2, name: 'Dos' });
  expect(useTenantContextStore.getState().tenant).toBeNull();
  expect(useTenantContextStore.getState().revision).toBe(0);
});
it('la renovación conserva el tenant y otro inicio de sesión lo limpia', () => {
  const user = loginResponse({ isSuperAdmin: true });
  useAuthStore.getState().accept(user, user);
  useTenantContextStore.getState().seleccionar({ id: 2, name: 'Dos' });
  useAuthStore.getState().renew(user, user);
  expect(useTenantContextStore.getState().tenant?.id).toBe(2);
  useAuthStore.getState().clear('logout');
  expect(useTenantContextStore.getState().tenant).toBeNull();
});
it('limpia el filtro si la renovación deja de reconocer al superusuario', () => {
  const user = loginResponse({ isSuperAdmin: true });
  useAuthStore.getState().accept(user, user);
  useTenantContextStore.getState().seleccionar({ id: 2, name: 'Dos' });
  useEmpresaContextStore.getState().seleccionar(22);
  useAuthStore.getState().renew({ ...user, isSuperAdmin: false }, user);
  expect(useTenantContextStore.getState().tenant).toBeNull();
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBeNull();
});
