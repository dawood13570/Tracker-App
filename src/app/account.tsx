import { requestLocalNotifications, scheduleMorningReminder } from '../services/notifications';
import { shareBackup, pickBackup, importBackup, recoverLastRestore, hasRecoveryBackup } from '../services/backup';
import { reportError } from '../utils/errors';
import { router, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useColors, useThemeStore } from '@/store/themeStore';
import { useStore } from '@/store/useStore';
import { Palette } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Icon = keyof typeof Ionicons.glyphMap;
const hourLabel = (hour: number) => `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
const hoursWith = (presets: number[], current: number) => [...new Set([...presets, current])].sort((a, b) => a - b);
const confirm = (title: string, message: string, label: string) => new Promise<boolean>(resolve => Alert.alert(title, message, [
  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
  { text: label, style: 'destructive', onPress: () => resolve(true) },
], { cancelable: true, onDismiss: () => resolve(false) }));

export default function AccountScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { mode, setMode } = useThemeStore();
  const settings = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [permission, setPermission] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => {
      try { if (active) setRecoveryAvailable(hasRecoveryBackup()); } catch (error) { reportError(error); }
      Notifications.getPermissionsAsync().then(result => { if (active) setPermission(result.granted ? 'granted' : result.status); }).catch(reportError);
    };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; subscription.remove(); };
  }, []));
  const run = async (label: string, work: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(label);
    try { await work(); } catch (error) { reportError(error); }
    finally { busyRef.current = false; setBusy(null); try { setRecoveryAvailable(hasRecoveryBackup()); } catch (error) { reportError(error); } }
  };
  const allowNotifications = async () => {
    const allowed = await requestLocalNotifications(); setPermission(allowed ? 'granted' : 'denied');
    if (!allowed) Alert.alert('Notifications are off', 'Allow notifications for Reckon in your device settings.', [
      { text: 'Not now', style: 'cancel' }, { text: 'Open settings', onPress: () => { void Linking.openSettings().catch(reportError); } },
    ]);
    return allowed;
  };
  const section = (title: string, icon: Icon, children: ReactNode) => <View style={styles.section}>
    <View style={styles.sectionHeading}><Ionicons name={icon} size={16} color={colors.textMuted} /><Text style={styles.sectionLabel}>{title}</Text></View>
    <View style={styles.card}>{children}</View>
  </View>;
  const divider = <View style={styles.divider} />;
  const toggle = (title: string, description: string, value: boolean, onChange: (value: boolean) => void) => <View style={styles.row}>
    <View style={styles.rowText}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.description}>{description}</Text></View>
    <Switch accessibilityLabel={title} disabled={busy !== null} value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.accent }} />
  </View>;
  const chips = <T extends string | number,>(options: { value: T; label: string }[], selected: T, select: (value: T) => void) => <View style={styles.chips}>{options.map(option => <TouchableOpacity
    key={option.value} accessibilityRole="radio" accessibilityState={{ checked: option.value === selected, disabled: busy !== null }} disabled={busy !== null}
    onPress={() => select(option.value)} style={[styles.chip, option.value === selected && styles.chipSelected]}>
    <Text style={[styles.chipText, option.value === selected && styles.chipTextSelected]}>{option.label}</Text>
  </TouchableOpacity>)}</View>;
  const action = (title: string, description: string, icon: Icon, onPress: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: disabled || busy !== null }} disabled={disabled || busy !== null} onPress={onPress} style={[styles.row, disabled && { opacity: 0.45 }]}>
    <View style={styles.actionIcon}><Ionicons name={icon} size={20} color={colors.accent} /></View>
    <View style={styles.rowText}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.description}>{description}</Text></View>
    <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
  </TouchableOpacity>;

  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
    <Text style={styles.title}>Account</Text><Text style={styles.subtitle}>Make Reckon work your way.</Text>
    <View style={styles.localCard}><View style={styles.localIcon}><Ionicons name="phone-portrait-outline" size={24} color={colors.accent} /></View><View style={styles.rowText}>
      <Text style={styles.rowTitle}>Your personal workspace</Text><Text style={styles.description}>Stored on this device. Export a backup to keep a separate copy.</Text>
    </View></View>

    {section('Appearance', 'color-palette-outline', <View style={styles.column}>
      <Text style={styles.rowTitle}>Theme</Text>
      {chips([{ value: 'light' as const, label: 'Light' }, { value: 'dark' as const, label: 'Dark' }], mode, setMode)}
    </View>)}
    {section('Your day', 'moon-outline', <>
      {toggle('Extend past midnight', 'Keep yesterday open until your cutoff, or finalize the day yourself.', settings.nightOwlMode, settings.setNightOwlMode)}
      {settings.nightOwlMode && <>{divider}<View style={styles.column}><Text style={styles.rowTitle}>Start the next day at</Text>
        {chips(hoursWith([2, 3, 4], settings.dayBoundaryHour).map(value => ({ value, label: hourLabel(value) })), settings.dayBoundaryHour, settings.setDayBoundaryHour)}
      </View></>}
    </>)}
    {section('Tasks & focus', 'checkmark-circle-outline', <>
      {toggle('Evolving priority', 'Give neglected tasks more priority over time.', settings.evolvingPriorityEnabled, settings.setEvolvingPriorityEnabled)}{divider}
      {toggle('Focus filtering', 'Temporarily hide low-priority work when a neglected task needs attention.', settings.autoArchiveEnabled, settings.setAutoArchiveEnabled)}{divider}
      {toggle('Confirm progress completion', 'Ask before marking a quantity task complete or reopening it.', !settings.skipProgressionAlerts, value => settings.setSkipProgressionAlerts(!value))}
    </>)}
    {section('New task defaults', 'options-outline', <>
      {toggle('Carry unfinished tasks forward', 'Start new tasks with rollover enabled.', settings.defaultRolloverEnabled, settings.setDefaultRolloverEnabled)}{divider}
      <View style={styles.column}><Text style={styles.rowTitle}>When you exceed the target</Text><Text style={styles.description}>Applies to new quantity tasks. Each task can override this.</Text>
        {chips([{ value: 'none' as const, label: 'Ask each time' }, { value: 'breathing_room' as const, label: 'Ease pace' }, { value: 'bank_it' as const, label: 'Bank surplus' }], settings.defaultSurplusMode === 'raise_bar' ? 'none' : settings.defaultSurplusMode, settings.setDefaultSurplusMode)}
        <Text style={styles.hint}>Bank covers later work. Raising a target always asks for your choice.</Text>
      </View>
    </>)}
    {section('Reminders', 'notifications-outline', <>
      {toggle('Morning reminder', 'A daily prompt to review Today, in your local time.', settings.morningDigestEnabled, enabled => void run('Updating reminder…', async () => {
        if (enabled && !(await allowNotifications())) return;
        await scheduleMorningReminder(enabled, settings.morningDigestHour); settings.setMorningDigest(enabled);
      }))}
      {settings.morningDigestEnabled && <View style={[styles.column, { paddingTop: 0 }]}>{chips(hoursWith([6, 7, 8, 9, 10], settings.morningDigestHour).map(value => ({ value, label: hourLabel(value) })), settings.morningDigestHour, hour => void run('Updating reminder…', async () => {
        if (!(await allowNotifications())) return;
        await scheduleMorningReminder(true, hour); settings.setMorningDigest(true, hour);
      }))}</View>}{divider}
      {toggle('Critical pace alerts', 'A check-in when a quantity task falls critically behind.', settings.criticalPaceNotificationsEnabled, enabled => void run('Updating alerts…', async () => {
        if (!enabled || await allowNotifications()) settings.setCriticalPaceNotificationsEnabled(enabled);
      }))}
      {permission === 'denied' && <>{divider}{action('Notifications blocked', 'Open device settings to allow reminders.', 'notifications-off-outline', () => { void Linking.openSettings().catch(reportError); })}</>}
    </>)}
    {section('History & backups', 'archive-outline', <>
      {action('Task history', 'Review completions, skips, and moved work.', 'time-outline', () => router.push('/task-history'))}{divider}
      {action('Export backup', 'Save records, settings, and drafts outside the app.', 'download-outline', () => void run('Preparing backup…', shareBackup))}{divider}
      {action('Restore a backup', 'Choose a file. Review before replacing current data.', 'folder-open-outline', () => void run('Restoring backup…', async () => {
        const backup = await pickBackup(); if (!backup) return;
        if (!(await confirm('Replace local data?', 'Your selected backup will replace current records and settings. A recovery copy is saved first.', 'Restore'))) return;
        await importBackup(backup); router.replace('/today');
      }))}{divider}
      {action('Recover previous data', recoveryAvailable ? 'Undo the last import using its recovery copy.' : 'Available after your first backup restore.', 'arrow-undo-outline', () => void run('Recovering data…', async () => {
        if (!(await confirm('Recover previous data?', 'Replace current data with the copy saved before the last import?', 'Recover'))) return;
        await recoverLastRestore(); router.replace('/today');
      }), !recoveryAvailable)}
    </>)}
    {busy && <View accessibilityLiveRegion="polite" style={styles.busy}><ActivityIndicator color={colors.accent} /><Text style={styles.description}>{busy}</Text></View>}
    <Text style={styles.footer}>Reckon {Constants.expoConfig?.version ?? ''} · Offline workspace</Text>
  </ScrollView>;
}
const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  localCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceElevated, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSubtle, marginBottom: 8 },
  localIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSubtle, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 72 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  description: { fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 4 },
  hint: { fontSize: 11, lineHeight: 17, color: colors.textMuted, marginTop: 12 },
  column: { padding: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle, marginHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSubtle },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.paceOnTrackBg },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: colors.paceOnTrackText },
  actionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  footer: { color: colors.textMuted, textAlign: 'center', fontSize: 11, marginTop: 28 },
});
