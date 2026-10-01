import { scheduleMorningReminder } from '../services/notifications';
import { useStore } from '../store/useStore';
import { Welcome } from '../components/Welcome';
import { useAppDay } from '../hooks/use-app-day';
import { prepareDatabase } from '../db/initialize';
import { reportError } from '../utils/errors';
// src/app/_layout.tsx
import { useColors, useThemeStore } from '@/store/themeStore';
import { Palette } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as Notifications from 'expo-notifications';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import migrations from '../../drizzle/migrations';
import { registerRolloverTask, runRolloverNow, checkCriticalPace } from '../../src/tasks/rolloverTask';
import { db } from '../db/client';
import { useActivityStore } from '../store/activityStore';
import { useEventStore } from '../store/eventStore';
import { useHabitStore } from '../store/habitStore';
import { useTaskStore } from '../store/taskStore';
import { getLocalDateString } from '../utils/date';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function MainTabs() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [error, setError] = useState<Error | null>(null);
  const [ready, setReady] = useState(false);
  const appDay = useAppDay();
  const morningEnabled = useStore(s => s.morningDigestEnabled);
  const morningHour = useStore(s => s.morningDigestHour);
  useEffect(() => { if (ready) scheduleMorningReminder(morningEnabled, morningHour).catch(reportError); }, [ready, morningEnabled, morningHour]);
  useEffect(() => { prepareDatabase().then(() => setReady(true)).catch(setError); }, []);
  const insets = useSafeAreaInsets();

  const { loadTasks, setSelectedDate } = useTaskStore();
  const { loadHabits } = useHabitStore();
  const { loadEvents } = useEventStore();
  const { loadActivitiesForDate } = useActivityStore();

  useEffect(() => {
    if (!ready) return;
    registerRolloverTask(60 * 60 * 24).catch(reportError);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const refresh = async () => {
      await runRolloverNow();
      if (useStore.getState().criticalPaceNotificationsEnabled) await checkCriticalPace();
      await Promise.all([loadTasks(appDay), loadHabits(appDay), loadEvents(appDay), loadActivitiesForDate(appDay)]);
    };
    refresh().catch(reportError);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh().catch(reportError); });
    return () => listener.remove();
  }, [ready, appDay, loadTasks, loadHabits, loadEvents, loadActivitiesForDate]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Database Migration Error:</Text>
        <Text style={styles.errorText}>{error.message}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Applying migrations...</Text>
      </View>
    );
  }

  return (
    <>
    <Welcome />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          },
        ],
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="notes-history"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sunny-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="horizon"
        options={{
          title: 'Horizon',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="pursuits"
        options={{
          title: 'Pursuits',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="task-history" options={{ href: null }} />
    </Tabs>
    </>
  );
}

export default function RootLayout() {
  const mode = useThemeStore((s) => s.mode);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <MainTabs />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background,
    },
    errorTitle: {
      color: colors.danger,
      fontWeight: 'bold',
      fontSize: 16,
      marginBottom: 6,
    },
    errorText: {
      color: colors.textPrimary,
      textAlign: 'center',
      fontSize: 13,
    },
    loadingText: {
      marginTop: 10,
      color: colors.textSecondary,
      fontSize: 14,
    },
    tabBar: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingTop: 6,
      elevation: 8,
    },
    tabLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
  });