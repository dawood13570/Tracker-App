// src/app/_layout.tsx
import { useColors, useThemeStore } from '@/store/themeStore';
import { Palette } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as Notifications from 'expo-notifications';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import migrations from '../../drizzle/migrations';
import { registerRolloverTask, runRolloverNow } from '../../src/tasks/rolloverTask';
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

  const { success, error } = useMigrations(db, migrations);
  const insets = useSafeAreaInsets();

  const { loadTasks, setSelectedDate } = useTaskStore();
  const { loadHabits } = useHabitStore();
  const { loadEvents } = useEventStore();
  const { loadActivitiesForDate } = useActivityStore();

  useEffect(() => {
    async function initBackgroundJobs() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await registerRolloverTask(60 * 60 * 24);
      }
    }

    if (success) {
      initBackgroundJobs();
    }
  }, [success]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 1, 0);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();

      timerId = setTimeout(async () => {
        const todayStr = getLocalDateString(new Date());
        setSelectedDate(todayStr);
        await runRolloverNow();
        await Promise.all([loadTasks(), loadHabits(), loadEvents(), loadActivitiesForDate(todayStr)]);
        scheduleMidnightRefresh();
      }, msUntilMidnight);
    };

    scheduleMidnightRefresh();

    let lastKnownDate = getLocalDateString(new Date());
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const currentDate = getLocalDateString(new Date());
        if (currentDate !== lastKnownDate) {
          lastKnownDate = currentDate;
          setSelectedDate(currentDate);
          await runRolloverNow();
          await Promise.all([loadTasks(), loadHabits(), loadEvents(), loadActivitiesForDate(currentDate)]);
        }
      }
    });

    return () => {
      clearTimeout(timerId);
      subscription.remove();
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Database Migration Error:</Text>
        <Text style={styles.errorText}>{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Applying migrations...</Text>
      </View>
    );
  }

  return (
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
    </Tabs>
  );
}

export default function RootLayout() {
  const mode = useThemeStore((s) => s.mode);

  return (
    <GestureHandlerRootView style={{ flex: 1 }} key={mode}>
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