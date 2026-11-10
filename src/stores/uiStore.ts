import { create } from 'zustand';

export const useUiStore = create<{
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleCollapsed: () => void;
  toggleSidebar: () => void;
  reset: () => void;
}>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  toggleCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  reset: () => set({ sidebarOpen: false, sidebarCollapsed: false }),
}));
