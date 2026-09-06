import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import {
  applyRolloverSnapshots,
  deleteTask,
  getActiveProgressionTasks,
  getCurrentProgress,
  getProgressLogsByTask,
  getRolloverCandidates,
  getTaskByDate,
} from '../db/queries';
import { calculatePace } from '../engine/pace';
import { processRollover } from '../engine/rollover';
import { getLocalDateString } from '../utils/date';

export const BACKGROUND_ROLLOVER_TASK = 'MIDNIGHT_ROLLOVER';

export async function runRolloverNow(): Promise<BackgroundFetch.BackgroundFetchResult> {
  const todayStr = getLocalDateString();
  const candidates = await getRolloverCandidates(todayStr);

  if (candidates.length === 0) {
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  const todayTasks = await getTaskByDate(todayStr);

  const inputs = candidates.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    priority: t.priority,
    isCompleted: Boolean(t.isCompleted),
    rolloverEnabled: Boolean(t.rolloverEnabled),
    scheduledDate: t.scheduledDate,
    procrastinationCount: t.procrastinationCount,
    scope: t.scope ?? 'daily',
    totalProgress: t.totalProgress,
    progressUnit: t.progressUnit,
  }));

  const actions = processRollover(inputs, todayStr);

  if (actions.length > 0) {
    for (const action of actions) {
      const sourceTask = candidates.find((c) => c.id === action.sourceId);
      if (!sourceTask) continue;

      const duplicateTodayTask = todayTasks.find(
        (t) =>
          !t.isCompleted &&
          t.title.trim().toLowerCase() === sourceTask.title.trim().toLowerCase() &&
          t.type === sourceTask.type
      );

      if (duplicateTodayTask) {
        await deleteTask(duplicateTodayTask.id);
      }
    }

    await applyRolloverSnapshots(actions);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Good Morning ☀️',
        body: `Good morning. ${actions.length} task snapshot${actions.length > 1 ? 's' : ''} created.`,
      },
      trigger: null,
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  }

  return BackgroundFetch.BackgroundFetchResult.NoData;
}

export async function checkCriticalPace() {
  const activeTasks = await getActiveProgressionTasks();
  if (activeTasks.length === 0) return;

  const results = await Promise.all(
    activeTasks.map(async (t) => {
      const [currentProgress, logs] = await Promise.all([
        getCurrentProgress(t.id),
        getProgressLogsByTask(t.id),
      ]);
      const pace = calculatePace({ ...t, currentProgress }, logs);
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
}

export function defineRolloverTask() {
  if (TaskManager.isTaskDefined(BACKGROUND_ROLLOVER_TASK)) {
    return;
  }

  TaskManager.defineTask(BACKGROUND_ROLLOVER_TASK, async () => {
    try {
      const result = await runRolloverNow();
      await checkCriticalPace();
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