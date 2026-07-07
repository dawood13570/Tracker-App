// tasks/background.ts
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import { syncLogs } from '../db/schema';
import { getDrizzleInstance } from '../db/clients'; 

const BACKGROUND_FETCH_TASK = 'expo-background-fetch-task';

export async function executeSyncRoutine() {
  const timestampString = new Date().toLocaleString();
  console.log(`[SYNC ROUTINE] Execution triggered! Time: ${timestampString}`);

  try {
    // Open a separate synchronous data connection handle for the background thread
    const nativeDb = SQLite.openDatabaseSync('my_app_db.db');
    const db = getDrizzleInstance(nativeDb);

    await db.insert(syncLogs).values({
      timestamp: timestampString,
      status: 'SUCCESS',
    });
    console.log('[SYNC ROUTINE] Successfully inserted fresh row into SQLite disk file!');

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Database Synced! 💾",
        body: `A new persistent log entry was recorded at ${timestampString}`,
      },
      trigger: null,
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("[SYNC ROUTINE] Critical Task Failure:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
}

TaskManager.defineTask(BACKGROUND_FETCH_TASK, executeSyncRoutine);

export async function registerBackgroundFetch() {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 60 * 15, 
    stopOnTerminate: false,   
    startOnBoot: true,        
  });
}

// Add this to tasks/background.ts

export async function scheduleFiveMinuteTimer() {
  const currentTimestamp = new Date().toLocaleString();
  console.log(`[ALARM SYSTEM] Scheduling a native hardware timer at: ${currentTimestamp}`);

  try {
    // 1. Tell the phone's native OS clock to schedule a notification banner
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "1 Minute Elapsed! ⏱️",
        body: "Your native hardware timer fired successfully in the background.",
        sound: true, // Make the phone buzz/play a sound
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 60,
      },
    });

    console.log('[ALARM SYSTEM] Native hardware timer successfully armed for 1 minute from now!');
  } catch (error) {
    console.error("[ALARM SYSTEM] Failed to schedule native timer:", error);
  }
}