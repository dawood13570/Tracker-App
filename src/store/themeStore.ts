import { darkPalette, lightPalette, Palette } from '@/theme/colors';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { settingsStorage } from './storage';

interface ThemeState {
  mode: 'dark' | 'light';
  colors: Palette;
  toggleTheme: () => void;
  setMode: (mode: 'dark' | 'light') => void;
}

export const useThemeStore = create<ThemeState>()(persist((set) => ({
  mode: 'dark',
  colors: darkPalette,
  toggleTheme: () =>
    set((state) => {
      const next = state.mode === 'dark' ? 'light' : 'dark';
      return { mode: next, colors: next === 'light' ? lightPalette : darkPalette };
    }),
  setMode: (mode) => set({ mode, colors: mode === 'light' ? lightPalette : darkPalette }),
}), { name: 'reckon-theme', storage: createJSONStorage(() => settingsStorage), partialize: (state) => ({ mode: state.mode }), merge: (saved, current) => { const mode = (saved as { mode?: string })?.mode === 'light' ? 'light' : 'dark'; return { ...current, mode, colors: mode === 'light' ? lightPalette : darkPalette }; } }));

export const useColors = () => useThemeStore((s) => s.colors);