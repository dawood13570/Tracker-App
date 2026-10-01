import { useTaskStore } from '../store/taskStore';
import { useHabitStore } from '../store/habitStore';
import { useEventStore } from '../store/eventStore';
import { useActivityStore } from '../store/activityStore';
import { useTagStore } from '../store/tagStore';
import { getAppToday } from '../utils/date';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import Storage from 'expo-sqlite/kv-store';
import { exportBackup, restoreBackup, validateBackup, type Backup } from '../db/backup';
import { useStore } from '../store/useStore';
import { useThemeStore } from '../store/themeStore';
import { isBackupPreference as preferenceKey } from '../db/backupPreferences';
export function currentBackup() {
  return { ...exportBackup(), preferences: Object.fromEntries(Storage.getAllKeysSync().filter(preferenceKey).map(key => [key, Storage.getItemSync(key)!])) };
}
export async function shareBackup() {
  const file = new File(Paths.document, `reckon-backup-${Date.now()}.json`);
  file.write(JSON.stringify(currentBackup(), null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Reckon backup' });
}
export async function pickBackup(): Promise<Backup | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  if (file.size > 20 * 1024 * 1024) throw new Error('Backup exceeds the 20 MB import limit.');
  const backup = validateBackup(JSON.parse(await file.text()));
  if (backup.preferences && Object.entries(backup.preferences).some(([k,v]) => !preferenceKey(k) || typeof v !== 'string')) throw new Error('Invalid backup preferences.');
  return backup;
}
export async function importBackup(backup: Backup) {
  validateBackup(backup);
  const recovery = new File(Paths.document, 'reckon-before-last-restore.json');
  const previous = currentBackup();
  validateBackup(previous);
  recovery.write(JSON.stringify(previous)); // If this fails, do not start replacement.
  try {
    restoreBackup(backup);
    for (const key of Storage.getAllKeysSync().filter(preferenceKey)) Storage.removeItemSync(key);
    for (const [key, value] of Object.entries(backup.preferences ?? {})) Storage.setItemSync(key, value);
    useStore.setState(useStore.getInitialState(), true); useThemeStore.setState(useThemeStore.getInitialState(), true);
    // setState persists defaults, so write the imported values again before hydration.
    for (const [key, value] of Object.entries(backup.preferences ?? {})) Storage.setItemSync(key, value);
    await useStore.persist.rehydrate(); await useThemeStore.persist.rehydrate();
    useActivityStore.setState({ logsByDate: {}, masters: [] });
    useTagStore.setState(state => ({ tagVersion: state.tagVersion + 1 }));
    await Promise.all([useTaskStore.getState().loadTasks(), useHabitStore.getState().loadHabits(), useEventStore.getState().loadEvents(), useActivityStore.getState().loadMasters(), useActivityStore.getState().loadActivitiesForDate(getAppToday()), useTagStore.getState().loadTags(), useTagStore.getState().loadMostUsedTags()]);
  } catch (error) {
    restoreBackup(previous);
    for (const key of Storage.getAllKeysSync().filter(preferenceKey)) Storage.removeItemSync(key);
    for (const [key, value] of Object.entries(previous.preferences)) Storage.setItemSync(key, value);
    await useStore.persist.rehydrate(); await useThemeStore.persist.rehydrate();
    throw error;
  }
}
export async function recoverLastRestore() {
  const file = new File(Paths.document, 'reckon-before-last-restore.json');
  if (!file.exists) throw new Error('There is no recovery copy yet.');
  const backup = validateBackup(JSON.parse(await file.text()));
  await importBackup(backup);
}
