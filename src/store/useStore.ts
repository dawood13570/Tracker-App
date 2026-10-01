// src/store/useStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { settingsStorage } from './storage';

interface AppState {
  morningDigestEnabled: boolean;
  morningDigestHour: number;
  setMorningDigest: (enabled: boolean, hour?: number) => void;
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

  skipProgressionAlerts: boolean;
  setSkipProgressionAlerts: (skip: boolean) => void;

  // interface AppState additions
  defaultRolloverEnabled: boolean;
  setDefaultRolloverEnabled: (enabled: boolean) => void;

  defaultSurplusMode: 'breathing_room' | 'raise_bar' | 'bank_it' | 'none';
  setDefaultSurplusMode: (mode: 'breathing_room' | 'raise_bar' | 'bank_it' | 'none') => void;

  criticalPaceNotificationsEnabled: boolean;
  setCriticalPaceNotificationsEnabled: (enabled: boolean) => void;
}

export const useStore = create<AppState>()(persist((set) => ({
  morningDigestEnabled: false,
  morningDigestHour: 8,
  setMorningDigest: (enabled, hour) => set(state => ({ morningDigestEnabled: enabled, morningDigestHour: hour ?? state.morningDigestHour })),
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

  nightOwlMode: false,
  setNightOwlMode: (enabled: boolean) => set({ nightOwlMode: enabled }),

  manualDayOverrideDate: null,
  setManualDayOverrideDate: (date: string | null) => set({ manualDayOverrideDate: date }),

  skipProgressionAlerts: false,
  setSkipProgressionAlerts: (skip: boolean) => set({ skipProgressionAlerts: skip }),

  defaultRolloverEnabled: true,
  setDefaultRolloverEnabled: (enabled) => set({ defaultRolloverEnabled: enabled }),

  defaultSurplusMode: 'none',
  setDefaultSurplusMode: (mode) => set({ defaultSurplusMode: mode }),

  criticalPaceNotificationsEnabled: false,
  setCriticalPaceNotificationsEnabled: (enabled) => set({ criticalPaceNotificationsEnabled: enabled }),
}), { name: 'reckon-settings', storage: createJSONStorage(() => settingsStorage), partialize: ({ isSidebarOpen, userId, ...state }) => state }));

