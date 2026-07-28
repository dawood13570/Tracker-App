// app/_layout.tsx
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as Notifications from 'expo-notifications';
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import migrations from '../../drizzle/migrations';
import '../../src/tasks/rolloverTask';
import { defineRolloverTask, registerRolloverTask } from '../../src/tasks/rolloverTask';
import { db } from '../db/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

defineRolloverTask();

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    async function initBackgroundJobs() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await registerRolloverTask(60);
      }
    }

    if (success) {
      initBackgroundJobs();
    }
  }, [success]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', fontWeight: 'bold' }}>Database Migration Error:</Text>
        <Text style={{ textAlign: 'center', marginTop: 5 }}>{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1c8db9" />
        <Text style={{ marginTop: 10 }}>Syncing database schema...</Text>
      </View>
    );
  }

  return <Slot />;
}