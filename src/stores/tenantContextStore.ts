import { create } from 'zustand';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useEmpresaContextStore } from './empresaContextStore';

export interface TenantSeleccionado {
  id: number;
  name: string;
}
export const useTenantContextStore = create<{
  tenant: TenantSeleccionado | null;
  revision: number;
  seleccionar: (tenant: TenantSeleccionado | null) => void;
}>((set) => ({
  tenant: null,
  revision: 0,
  seleccionar: (tenant) => {
    if (useEmpresaContextStore.getState().seleccionBloqueada) return;
    set((previous) => {
      if (previous.tenant?.id === tenant?.id) return previous;
      useEmpresaContextStore.getState().limpiar();
      return { tenant, revision: previous.revision + 1 };
    });
  },
}));

// A data filter belongs to this login only. Renewal preserves it.
useAuthStore.subscribe((state, previous) => {
  const lostSuperuser =
    'user' in state.session &&
    !state.session.user.isSuperAdmin &&
    'user' in previous.session &&
    previous.session.user.isSuperAdmin;
  if (state.revision !== previous.revision || lostSuperuser) {
    useEmpresaContextStore.setState({
      empresaSeleccionadaId: null,
      seleccionBloqueada: false,
    });
    useTenantContextStore.setState((scope) => ({
      tenant: null,
      revision: scope.revision + 1,
    }));
  }
});
