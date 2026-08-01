import { create } from 'zustand';

interface AppState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  userId: string | null;
  setUserId: (id: string | null) => void;

  // Global switch for the Evolving Priority System (3.5.5).
  // In-memory only for now — resets to `true` on every app restart.
  // Persisting this (AsyncStorage) and giving it a real UI both belong
  // to Milestone 7.4 (Global settings screen), not here.
  evolvingPriorityEnabled: boolean;
  setEvolvingPriorityEnabled: (enabled: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  userId: null,
  setUserId: (id) => set({ userId: id }),

  evolvingPriorityEnabled: true,
  setEvolvingPriorityEnabled: (enabled) => set({ evolvingPriorityEnabled: enabled }),
}));