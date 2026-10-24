import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../store/themeStore';
type Action = { label: string; accessibilityLabel?: string; icon: keyof typeof Ionicons.glyphMap; tone: 'complete' | 'postpone' | 'skip'; onPress: () => void };
export function TaskSwipeActions({ actions }: { actions: Action[] }) {
  const colors = useColors();
  return <View style={styles.tray}>{actions.map(action => {
    const foreground = action.tone === 'complete' ? colors.priorityLowText : action.tone === 'postpone' ? colors.paceOnTrackText : colors.priorityMediumText;
    const background = action.tone === 'complete' ? colors.successBg : action.tone === 'postpone' ? colors.paceOnTrackBg : colors.priorityMediumBg;
    return <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.accessibilityLabel ?? action.label} onPress={action.onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: background, borderColor: foreground + '45', opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={action.icon} size={22} color={foreground} />
      <Text style={[styles.label, { color: foreground }]}>{action.label}</Text>
    </Pressable>;
  })}</View>;
}
const styles = StyleSheet.create({
  tray: { flexDirection: 'row', alignItems: 'stretch', gap: 6, paddingHorizontal: 6, paddingBottom: 10 },
  action: { width: 82, minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 6 },
  label: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
