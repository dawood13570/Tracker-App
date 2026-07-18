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

        CREATE TABLE IF NOT EXISTS \`habits\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          \`title\` text NOT NULL,
          \`cadence_type\` text NOT NULL,
          \`cadence_target\` integer,
          \`created_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS \`habit_logs\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          \`habit_id\` integer NOT NULL,
          \`date\` text NOT NULL,
          \`created_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
          FOREIGN KEY (\`habit_id\`) REFERENCES \`habits\`(\`id\`) ON UPDATE no action ON DELETE cascade
        );

        CREATE TABLE IF NOT EXISTS \`events\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          \`title\` text NOT NULL,
          \`start_time\` text NOT NULL,
          \`end_time\` text,
          \`location\` text,
          \`created_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS \`notes\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          \`scope\` text NOT NULL,
          \`date_key\` text NOT NULL,
          \`content\` text,
          \`created_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
          \`updated_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS \`tags\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          \`name\` text NOT NULL,
          \`color\` text
        );

        CREATE TABLE IF NOT EXISTS \`task_tags\` (
          \`task_id\` integer NOT NULL,
          \`tag_id\` integer NOT NULL,
          FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON UPDATE no action ON DELETE cascade,
          FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade
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