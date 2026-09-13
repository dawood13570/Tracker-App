// src/store/useStore.ts
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

  dayBoundaryHour: number; // e.g. 3 for 3:00 AM
  setDayBoundaryHour: (hour: number) => void;

  nightOwlMode: boolean; // Enables extending today past midnight
  setNightOwlMode: (enabled: boolean) => void;

  manualDayOverrideDate: string | null; // Set when user manually clicks "Finalize Day"
  setManualDayOverrideDate: (date: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  userId: null,
  setUserId: (id) => set({ userId: id }),

  evolvingPriorityEnabled: true,
  setEvolvingPriorityEnabled: (enabled) => set({ evolvingPriorityEnabled: enabled }),

  autoArchiveEnabled: false,
  setAutoArchiveEnabled: (enabled) => set({ autoArchiveEnabled: enabled }),

  dayBoundaryHour: 3,
  setDayBoundaryHour: (hour: number) => set({ dayBoundaryHour: hour }),

  nightOwlMode: true,
  setNightOwlMode: (enabled: boolean) => set({ nightOwlMode: enabled }),

  manualDayOverrideDate: null,
  setManualDayOverrideDate: (date: string | null) => set({ manualDayOverrideDate: date }),
}));