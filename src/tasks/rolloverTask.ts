import { rolloverTo } from '../db/lifecycle';
import { getAppToday } from '../utils/date';
import { prepareDatabase } from '../db/initialize';
import { useStore } from '@/store/useStore';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { getActiveProgressionTasks, getEffectiveProgress, getProgressLogsByTask, getAllDescendantTasks } from '../db/queries';
import { calculatePace } from '../engine/pace';
import Storage from 'expo-sqlite/kv-store';
import { parseISO } from 'date-fns';

export const BACKGROUND_ROLLOVER_TASK = 'MIDNIGHT_ROLLOVER';

export async function runRolloverNow(): Promise<BackgroundFetch.BackgroundFetchResult> {
  const count = rolloverTo(getAppToday());
  return count ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
}

export async function checkCriticalPace() {
  const today = getAppToday();
  if (Storage.getItemSync('reckon-last-pace-alert') === today || !(await Notifications.getPermissionsAsync()).granted) return;
  const activeTasks = (await getActiveProgressionTasks()).filter(t => t.sourceTaskId == null && t.parentId == null && (!t.pausedUntil || t.pausedUntil <= today));
  if (activeTasks.length === 0) return;

  const results = await Promise.all(
    activeTasks.map(async (t) => {
      const descendants = await getAllDescendantTasks(t.id);
      const currentProgress = await getEffectiveProgress(t.id);
      const logs = (await Promise.all([t, ...descendants].map(child => getProgressLogsByTask(child.id)))).flat().filter(log => log.kind !== 'carry' && log.kind !== 'correction');
      const pace = calculatePace({ ...t, currentProgress }, logs, parseISO(today));
      return { title: t.title, pace };
    })
  );

  const critical = results.filter((r) => r.pace.status === 'Critical');
  if (critical.length === 0) return;

  const titles = critical.map((r) => r.title).join(', ');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Falling behind ⚠️',
      body: `${critical.length} task${critical.length > 1 ? 's are' : ' is'} behind pace: ${titles}`,
    },
    trigger: null,
  });
  Storage.setItemSync('reckon-last-pace-alert', today);
}

export function defineRolloverTask() {
  if (TaskManager.isTaskDefined(BACKGROUND_ROLLOVER_TASK)) {
    return;
  }

  TaskManager.defineTask(BACKGROUND_ROLLOVER_TASK, async () => {
    try {
      await prepareDatabase();
      const result = await runRolloverNow();
      if (useStore.getState().criticalPaceNotificationsEnabled) {
      await checkCriticalPace();
    }
      return result;
    } catch (error) {
      console.error('[BackgroundFetch] Failed:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

defineRolloverTask();

export async function registerRolloverTask(intervalInSeconds: number = 24 * 60 * 60) {
  try {
    defineRolloverTask();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_ROLLOVER_TASK);

    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_ROLLOVER_TASK, {
        minimumInterval: intervalInSeconds,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log(`[BackgroundFetch] Successfully registered (${intervalInSeconds}s interval)`);
    }
  } catch (err) {
    console.error('[BackgroundFetch] Registration failed:', err);
  }
}