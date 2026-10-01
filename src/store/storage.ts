import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';
// Sync hydration ensures headless jobs and first render see the same settings.
export const settingsStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => { Storage.removeItemSync(key); },
};
