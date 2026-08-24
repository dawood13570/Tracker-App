import { create } from 'zustand';

interface AppState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  userId: string | null;
  setUserId: (id: string | null) => void;

  evolvingPriorityEnabled: boolean;
  setEvolvingPriorityEnabled: (enabled: boolean) => void;

  autoArchiveEnabled: boolean;
  setAutoArchiveEnabled: (enabled: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  userId: null,
  setUserId: (id) => set({ userId: id }),

  evolvingPriorityEnabled: true,
  setEvolvingPriorityEnabled: (enabled) => set({ evolvingPriorityEnabled: enabled }),

  autoArchiveEnabled: false,
  setAutoArchiveEnabled: (enabled) => set({ autoArchiveEnabled: enabled})
}));