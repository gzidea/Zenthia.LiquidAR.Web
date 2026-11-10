import { create } from 'zustand';
import { useAuthStore } from '@/features/auth/stores/authStore';

export const useEmpresaContextStore = create<{
  empresaSeleccionadaId: number | null;
  seleccionBloqueada: boolean;
  bloquearSeleccion: (bloqueada: boolean) => void;
  seleccionar: (id: number) => void;
  limpiar: () => void;
}>((set) => ({
  empresaSeleccionadaId: null,
  seleccionBloqueada: false,
  bloquearSeleccion: (seleccionBloqueada) => set({ seleccionBloqueada }),
  seleccionar: (id) =>
    set((state) =>
      state.seleccionBloqueada ? state : { empresaSeleccionadaId: id },
    ),
  limpiar: () =>
    set((state) =>
      state.seleccionBloqueada ? state : { empresaSeleccionadaId: null },
    ),
}));

// A new login/logout changes revision; manual renewal preserves it.
useAuthStore.subscribe((state, previous) => {
  if (state.revision !== previous.revision)
    useEmpresaContextStore.setState({
      empresaSeleccionadaId: null,
      seleccionBloqueada: false,
    });
});
