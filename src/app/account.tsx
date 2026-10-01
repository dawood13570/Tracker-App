import { requestLocalNotifications, scheduleMorningReminder } from '../services/notifications';
import { shareBackup, pickBackup, importBackup, recoverLastRestore } from '../services/backup';
import { reportError } from '../utils/errors';
import { router } from 'expo-router';
import { useColors, useThemeStore } from '@/store/themeStore';
import { useStore } from '@/store/useStore';
import { Palette } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRESET_HOURS = [
  { label: '2:00 AM', value: 2 },
  { label: '3:00 AM', value: 3 },
  { label: '4:00 AM', value: 4 },
];

const SURPLUS_OPTIONS: { label: string; value: 'breathing_room' | 'raise_bar' | 'bank_it' | 'none' }[] = [
  { label: 'Ask Each Time', value: 'none' },
  { label: 'Ease Pace', value: 'breathing_room' },
  { label: 'Bank Buffer', value: 'bank_it' },
  { label: 'Raise Bar', value: 'raise_bar' },
];

export default function AccountScreen() {
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => { if (busy) return; setBusy(true); try { await work(); } catch (error) { reportError(error); } finally { setBusy(false); } };
  const restore = () => run(async () => { const backup = await pickBackup(); if (!backup) return; Alert.alert('Replace local data?', 'This restores the selected backup. A recovery copy of your current data will be saved first.', [{ text: 'Cancel' }, { text: 'Restore', style: 'destructive', onPress: () => { void run(async () => { await importBackup(backup); router.replace('/today'); }); } }]); });
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { mode, toggleTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const {
    evolvingPriorityEnabled,
    autoArchiveEnabled,
    setEvolvingPriorityEnabled,
    setAutoArchiveEnabled,
    nightOwlMode,
    setNightOwlMode,
    dayBoundaryHour,
    setDayBoundaryHour,
    defaultRolloverEnabled,
    setDefaultRolloverEnabled,
    defaultSurplusMode,
    setDefaultSurplusMode,
    morningDigestEnabled, morningDigestHour, setMorningDigest,
    criticalPaceNotificationsEnabled,
    setCriticalPaceNotificationsEnabled,
  } = useStore();

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.pageTitle}>Account</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/task-history')} style={{ paddingVertical: 14 }}><Text style={{ color: colors.accent }}>View task history</Text></TouchableOpacity>

      <Text style={styles.sectionLabel}>DAY CYCLE & TIMING</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingTitle}>Extend Day Past Midnight</Text>
            <Text style={styles.settingDesc}>
              Keep "Today" on yesterday's tasks until your cutoff hour or until you finalize the day.
            </Text>
          </View>
          <Switch
            value={nightOwlMode}
            onValueChange={setNightOwlMode}
            trackColor={{ false: colors.borderSubtle, true: colors.accent }}
          />
        </View>

        {nightOwlMode && (
          <>
            <View style={styles.divider} />
            <View style={styles.settingColumn}>
              <Text style={styles.settingTitle}>Day Cutoff Time</Text>
              <Text style={styles.settingDesc}>
                When does your yesterday officially switch to today?
              </Text>

              <View style={styles.presetButtonRow}>
                {PRESET_HOURS.map((preset) => {
                  const isSelected = dayBoundaryHour === preset.value;
                  return (
                    <TouchableOpacity
                      key={preset.value}
                      style={[
                        styles.presetButton,
                        isSelected && styles.presetButtonSelected,
                      ]}
                      onPress={() => setDayBoundaryHour(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.presetButtonText,
                          isSelected && styles.presetButtonTextSelected,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </View>

      <Text style={styles.sectionLabel}>TASK SETTINGS</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingTitle}>Evolving Priority</Text>
            <Text style={styles.settingDesc}>
              Neglected low-priority tasks escalate to high over time.
            </Text>
          </View>
          <Switch
            value={evolvingPriorityEnabled}
            onValueChange={setEvolvingPriorityEnabled}
            trackColor={{ false: colors.borderSubtle, true: colors.accent }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingTitle}>Auto-Archive</Text>
            <Text style={styles.settingDesc}>
              Hide low-priority tasks while a neglected task needs attention.
            </Text>
          </View>
          <Switch
            value={autoArchiveEnabled}
            onValueChange={setAutoArchiveEnabled}
            trackColor={{ false: colors.borderSubtle, true: colors.accent }}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>DEFAULTS FOR NEW TASKS</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingTitle}>Rollover by Default</Text>
            <Text style={styles.settingDesc}>New tasks start with "move to next day" turned on.</Text>
          </View>
          <Switch
            value={defaultRolloverEnabled}
            onValueChange={setDefaultRolloverEnabled}
            trackColor={{ false: colors.borderSubtle, true: colors.accent }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingColumn}>
          <Text style={styles.settingTitle}>Default Surplus Mode</Text>
          <Text style={styles.settingDesc}>How new Progression tasks handle beating pace, until changed per-task.</Text>
          <View style={[styles.presetButtonRow, { flexWrap: 'wrap' }]}>
            {SURPLUS_OPTIONS.map((opt) => {
              const isSelected = defaultSurplusMode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.presetButton, isSelected && styles.presetButtonSelected]}
                  onPress={() => setDefaultSurplusMode(opt.value)}
                >
                  <Text style={[styles.presetButtonText, isSelected && styles.presetButtonTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Morning reminder</Text><Text style={styles.settingDesc}>A daily invitation to review Today, in your device’s local time.</Text></View>
          <Switch accessibilityLabel="Morning reminder" value={morningDigestEnabled} onValueChange={enabled => void run(async () => {
            if (enabled && !(await requestLocalNotifications())) { Alert.alert('Notifications are off', 'Enable notifications for Reckon in device settings.'); return; }
            await scheduleMorningReminder(enabled, morningDigestHour); setMorningDigest(enabled);
          })} />
        </View>
        {morningDigestEnabled && <View style={styles.presetButtonRow}>{[6, 7, 8, 9, 10].map(hour => <TouchableOpacity key={hour} accessibilityRole="button" accessibilityState={{ selected: morningDigestHour === hour }} style={styles.presetButton} onPress={() => void run(async () => { await scheduleMorningReminder(true, hour); setMorningDigest(true, hour); })}><Text style={{ color: hour === morningDigestHour ? colors.accent : colors.textSecondary }}>{hour}:00</Text></TouchableOpacity>)}</View>}
      </View>
      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingTitle}>Critical Pace Alerts</Text>
            <Text style={styles.settingDesc}>Notify when a Progression task falls to Critical status.</Text>
          </View>
          <Switch
            value={criticalPaceNotificationsEnabled}
            onValueChange={enabled => void run(async () => { if (!enabled || await requestLocalNotifications()) setCriticalPaceNotificationsEnabled(enabled); else Alert.alert('Notifications are off', 'Enable notifications for Reckon in your device settings to receive reminders.'); })}
            trackColor={{ false: colors.borderSubtle, true: colors.accent }}
          />
        </View>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingTitle}>Light Mode</Text>
            <Text style={styles.settingDesc}>Switch between dark and light appearance.</Text>
          </View>
          <Switch
            value={mode === 'light'}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.borderSubtle, true: colors.accent }}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>DATA</Text>
      <View style={styles.settingsCard}>
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.settingRow} onPress={() => void run(shareBackup)}><Text style={styles.settingTitle}>{busy ? 'Working…' : 'Export backup'}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.settingRow} onPress={restore}><Text style={styles.settingTitle}>Import and restore backup</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.settingRow} onPress={() => Alert.alert('Recover previous data?', 'Restore the recovery copy from before your last import?', [{ text: 'Cancel' }, { text: 'Recover', onPress: () => void run(async () => { await recoverLastRestore(); router.replace('/today'); }) }])}><Text style={styles.settingTitle}>Recover data from before last import</Text></TouchableOpacity>
        <Text style={[styles.settingDesc, { padding: 14 }]}>Backups include records, settings, and saved drafts. Save a copy outside this app before uninstalling.</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 60 },
    pageTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 24,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 16,
    },
    settingsCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: 4,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    settingColumn: {
      padding: 14,
    },
    settingTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    settingDesc: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      lineHeight: 16,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderSubtle,
      marginHorizontal: 14,
    },
    presetButtonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    presetButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetButtonSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    presetButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    presetButtonTextSelected: {
      color: colors.textOnAccent,
      fontWeight: '700',
    },
  });