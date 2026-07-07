// app/_layout.tsx
import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { registerBackgroundFetch } from '../tasks/background';
import { customMigrations } from '../db/schema';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  
  useEffect(() => {
    // Safely register our background hardware worker alarm system
    registerBackgroundFetch()
      .then(() => console.log("Background fetch registered successfully!"))
      .catch((err: unknown) => console.error("Failed to register background fetch:", err)); 
  }, []);

  // This function runs deep inside the SQLiteProvider lifecycle, completely safe from native race conditions
  const handleDatabaseSetup = async (db: SQLite.SQLiteDatabase) => {
    try {
      console.log('[DATABASE] Constructing structural data channels...');
      for (const sqlCommand of customMigrations) {
        await db.execAsync(sqlCommand);
      }
      console.log('[DATABASE] Custom migrations applied and verified successfully!');
    } catch (error) {
      console.error('[DATABASE] Critical Migration Failure:', error);
    }
  };

  return (
    // databaseName sets up the local storage file
    // onInit ensures migrations run completely safely before any child view renders
    <SQLiteProvider databaseName="my_app_db.db" onInit={handleDatabaseSetup}>
      <Slot /> 
    </SQLiteProvider>
  );
}