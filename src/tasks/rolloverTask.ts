// src/tasks/rolloverTask.ts
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { applyRolloverMutations, getRolloverCandidates } from '../db/queries';
import { processRollover } from '../engine/rollover';
import { getLocalDateString } from '../utils/date';

export const BACKGROUND_ROLLOVER_TASK = 'MIDNIGHT_ROLLOVER';

export function defineRolloverTask() {
  if (TaskManager.isTaskDefined(BACKGROUND_ROLLOVER_TASK)) {
    return;
  }

  TaskManager.defineTask(BACKGROUND_ROLLOVER_TASK, async () => {
    try {
      const todayStr = getLocalDateString();
      console.log('--- [ROLLOVER RUNNING] --- Local Today:', todayStr);

      const candidates = await getRolloverCandidates(todayStr);
      console.log('Candidates in DB:', candidates.length);

      if (candidates.length === 0) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      const inputs = candidates.map((t) => ({
        id: t.id,
        isCompleted: Boolean(t.isCompleted),
        rolloverEnabled: Boolean(t.rolloverEnabled),
        scheduledDate: t.scheduledDate,
        procrastinationCount: t.procrastinationCount,
      }));

      const mutations = processRollover(inputs, todayStr);
      console.log('Mutations to apply:', mutations.length);

      if (mutations.length > 0) {
        await applyRolloverMutations(mutations);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Good Morning ☀️',
            body: `Good morning. ${mutations.length} task${mutations.length > 1 ? 's' : ''} carried over.`,
          },
          trigger: null,
        });

        return BackgroundFetch.BackgroundFetchResult.NewData;
      }

      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.error('[BackgroundFetch] Failed:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

// Guarantee execution on import
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