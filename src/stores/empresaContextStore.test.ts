import { expect, it } from 'vitest';
import { useEmpresaContextStore } from './empresaContextStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { loginResponse } from '@/test/fixtures';
it('mantiene fija la empresa mientras publica y libera el bloqueo al salir de sesión', () => {
  const store = useEmpresaContextStore.getState();
  store.seleccionar(1);
  store.bloquearSeleccion(true);
  store.seleccionar(2);
  store.limpiar();
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBe(1);
  store.bloquearSeleccion(false);
  store.seleccionar(2);
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBe(2);
  store.bloquearSeleccion(true);
  useAuthStore.getState().clear('logout');
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBeNull();
  expect(useEmpresaContextStore.getState().seleccionBloqueada).toBe(false);
});

it('conserva la empresa al renovar y la limpia al salir o iniciar otra sesión', () => {
  const user = loginResponse();
  useAuthStore.getState().accept(user, user);
  useEmpresaContextStore.getState().seleccionar(12);
  useAuthStore.getState().renew(user, user);
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBe(12);
  useAuthStore.getState().clear('logout');
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBeNull();
  useEmpresaContextStore.getState().seleccionar(12);
  useAuthStore.getState().accept(user, user);
  expect(useEmpresaContextStore.getState().empresaSeleccionadaId).toBeNull();
});
