import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
const channelId = 'reckon-reminders';
const digestId = 'reckon-morning';
export async function requestLocalNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(channelId, { name: 'Reckon reminders', importance: Notifications.AndroidImportance.DEFAULT });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}
export async function scheduleMorningReminder(enabled: boolean, hour: number) {
  await Notifications.cancelScheduledNotificationAsync(digestId);
  if (!enabled || !(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: digestId,
    content: { title: 'Your day in Reckon', body: 'Review your tasks, habits, and events. Choose what matters today.', data: { screen: 'today' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId },
  });
}
