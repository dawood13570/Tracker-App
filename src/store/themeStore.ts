import { applyTheme } from '@/theme/colors';
import { create } from 'zustand';

interface ThemeState {
  mode: 'dark' | 'light';
  toggleTheme: () => void;
  setMode: (mode: 'dark' | 'light') => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  toggleTheme: () =>
    set((state) => {
      const next = state.mode === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return { mode: next };
    }),
  setMode: (mode) => {
    applyTheme(mode);
    set({ mode });
  },
}));