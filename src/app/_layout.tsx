// app/_layout.tsx
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as Notifications from 'expo-notifications';
import { Slot } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import migrations from '../../drizzle/migrations'; // Verify this path matches your folder structure
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

export default function RootLayout() {
  // Drizzle handles tracking and execution safely on its own now.
  // No more manual execSync strings needed!
  const { success, error } = useMigrations(db, migrations);

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