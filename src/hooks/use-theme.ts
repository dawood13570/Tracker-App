import { useColors, useThemeStore } from '@/store/themeStore';
import { Palette } from '@/theme/colors';

/**
 * Returns the active theme palette and mode from the app theme store.
 * Reactive across all components when theme is toggled.
 */
export function useTheme(): Palette {
  return useColors();
}

/**
 * Optional helper if components also need the current mode ('light' | 'dark')
 * or the ability to toggle it.
 */
export function useThemeContext() {
  const { mode, setMode, toggleTheme } = useThemeStore();
  const colors = useColors();

  return {
    mode,
    colors,
    setMode,
    toggleTheme,
    isDark: mode === 'dark',
  };
}