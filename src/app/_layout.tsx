import * as Notifications from 'expo-notifications';
import { Slot } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { registerBackgroundFetch } from '../tasks/background';

// 1. Import your Drizzle tools and the migrations bundle from your first question!
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../drizzle/migrations';

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
    registerBackgroundFetch()
      .then(() => console.log("Background fetch registered successfully!"))
      .catch((err: unknown) => console.error("Failed to register background fetch:", err)); 
  }, []);

  // 2. This function executes safely inside SQLiteProvider before the app UI mounts
  const handleDatabaseSetup = async (db: SQLite.SQLiteDatabase) => {
    try {
      console.log('[DATABASE] Initializing Drizzle migration engine...');
      
      // Wrap the raw native database handle in a Drizzle instance
      const drizzleDb = drizzle(db);
      
      // Execute all migrations bundled inside your migrations.js automatically
      // This reads your SQL files (like worried_piledriver.sql) behind the scenes!
      await useMigrations(drizzleDb, migrations);
      
      console.log('[DATABASE] All automated migrations applied successfully!');
    } catch (error) {
      console.error('[DATABASE] Critical Migration Failure:', error);
    }
  };

  return (
    <SQLiteProvider databaseName="my_app_db.db" onInit={handleDatabaseSetup}>
      <Slot /> 
    </SQLiteProvider>
  );
}