// app/_layout.tsx
import * as Notifications from 'expo-notifications';
import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

// Import your raw native expo-sqlite handle
import { expoDb } from '../db/client';

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
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Execute our structural setup using a clean text string. 
      // This completely skips the Windows path bugs and Metro bundler issues!
      expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS \`tasks\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          \`title\` text NOT NULL,
          \`type\` text NOT NULL,
          \`priority\` text NOT NULL,
          \`is_completed\` integer DEFAULT 0 NOT NULL,
          \`scheduled_date\` text,
          \`current_progress\` integer DEFAULT 0,
          \`total_progress\` integer DEFAULT 0,
          \`progress_unit\` text,
          \`deadline\` text,
          \`subtasks_completed\` integer DEFAULT 0,
          \`subtasks_total\` integer DEFAULT 0,
          \`recurrence_type\` text DEFAULT 'none' NOT NULL,
          \`recurrence_interval\` integer,
          \`recurrence_days_of_week\` text,
          \`parent_id\` integer,
          \`procrastination_count\` integer DEFAULT 0,
          \`rollover_enabled\` integer DEFAULT 1 NOT NULL,
          \`surplus_mode\` text DEFAULT 'breathing_room',
          \`created_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
          \`updated_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
          FOREIGN KEY (\`parent_id\`) REFERENCES \`tasks\`(\`id\`) ON UPDATE no action ON DELETE cascade
        );

        CREATE TABLE IF NOT EXISTS \`progress_logs\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          \`task_id\` integer,
          \`amount\` integer NOT NULL,
          \`logged_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
          \`notes\` text,
          FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON UPDATE no action ON DELETE cascade
        );

        CREATE TABLE IF NOT EXISTS \`goals\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          \`title\` text NOT NULL,
          \`target_date\` text
        );
      `);

      setIsDbReady(true);
    } catch (error: any) {
      console.error("Database setup failed:", error);
      setDbError(error.message);
    }
  }, []);

  if (dbError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', fontWeight: 'bold' }}>Database Error:</Text>
        <Text style={{ textAlign: 'center', marginTop: 5 }}>{dbError}</Text>
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1c8db9" />
      </View>
    );
  }

  return <Slot />;
}