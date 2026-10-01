export const isBackupPreference = (key: string) => key === 'reckon-settings' || key === 'reckon-theme' || key === 'reckon-onboarded' || /^reckon-(note|pursuit)-draft:\d+$/.test(key);
export function validatePreferences(preferences: unknown): asserts preferences is Record<string, string> | undefined {
  if (preferences === undefined) return;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) throw new Error('Invalid backup preferences.');
  const booleans = ['evolvingPriorityEnabled', 'autoArchiveEnabled', 'nightOwlMode', 'skipProgressionAlerts', 'defaultRolloverEnabled', 'criticalPaceNotificationsEnabled', 'morningDigestEnabled'];
  for (const [key, value] of Object.entries(preferences)) {
    if (!isBackupPreference(key) || typeof value !== 'string') throw new Error('Invalid backup preference.');
    if (key === 'reckon-settings' || key === 'reckon-theme') {
      const saved = JSON.parse(value);
      const state = saved?.state;
      if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Invalid saved settings.');
      const allowed = key === 'reckon-theme' ? ['mode'] : [...booleans, 'dayBoundaryHour', 'manualDayOverrideDate', 'defaultSurplusMode', 'morningDigestHour'];
      for (const [name, setting] of Object.entries(state)) {
        if (!allowed.includes(name)) throw new Error(`Unknown setting: ${name}.`);
        if (booleans.includes(name) && typeof setting !== 'boolean') throw new Error('Invalid switch setting.');
        if (['dayBoundaryHour', 'morningDigestHour'].includes(name) && (!Number.isInteger(setting) || Number(setting) < 0 || Number(setting) > 23)) throw new Error('Invalid hour setting.');
        if (name === 'mode' && !['light', 'dark'].includes(String(setting))) throw new Error('Invalid theme.');
        if (name === 'defaultSurplusMode' && !['none', 'breathing_room', 'bank_it', 'raise_bar'].includes(String(setting))) throw new Error('Invalid surplus setting.');
        if (name === 'manualDayOverrideDate' && setting !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(setting))) throw new Error('Invalid day override.');
      }
    }
  }
}
