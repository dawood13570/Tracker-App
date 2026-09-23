import { darkPalette, lightPalette, Palette } from '@/theme/colors';
import { create } from 'zustand';

interface ThemeState {
  mode: 'dark' | 'light';
  colors: Palette;
  toggleTheme: () => void;
  setMode: (mode: 'dark' | 'light') => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  colors: darkPalette,
  toggleTheme: () =>
    set((state) => {
      const next = state.mode === 'dark' ? 'light' : 'dark';
      return { mode: next, colors: next === 'light' ? lightPalette : darkPalette };
    }),
  setMode: (mode) => set({ mode, colors: mode === 'light' ? lightPalette : darkPalette }),
}));

export const useColors = () => useThemeStore((s) => s.colors);