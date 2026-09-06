import { SelectionIndicator } from '@/components/SelectionIndicator';
import { ActivityWithLastLog } from '@/store/activityStore';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ActivityCardProps {
  activity: ActivityWithLastLog;
  selectionMode: boolean;
  isSelected: boolean;
  onPressCard: () => void;
  onLongPressCard: () => void;
  onToggleSelect: () => void;
  onQuickLog: () => void;
}

export function ActivityCard({
  activity,
  selectionMode,
  isSelected,
  onPressCard,
  onLongPressCard,
  onToggleSelect,
  onQuickLog,
}: ActivityCardProps) {
  const lastDoneText = activity.lastLog
    ? `Last done: ${activity.lastLog.date}`
    : 'Never logged';

  const handlePress = () => {
    if (selectionMode) {
      onToggleSelect();
    } else {
      onPressCard();
    }
  };

  return (
    <View style={[styles.card, isSelected && styles.selectedCard]} collapsable={false}>
      <View style={styles.cardInner}>
        <View style={styles.accentBar} />

        <Pressable
          onPress={handlePress}
          onLongPress={onLongPressCard}
          delayLongPress={250}
          style={({ pressed }) => [styles.pressableRow, pressed && styles.cardPressed]}
        >
          <View style={styles.cardRow}>
            {selectionMode && (
              <View style={styles.leadSlot}>
                <SelectionIndicator isSelected={isSelected} />
              </View>
            )}

            <View style={styles.cardContent}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {activity.title}
              </Text>
              <Text style={styles.lastDoneText}>{lastDoneText}</Text>
              {Boolean(activity.lastLog?.note) && (
                <Text style={styles.noteSnippet} numberOfLines={1}>
                  "{activity.lastLog?.note}"
                </Text>
              )}
            </View>

            {!selectionMode && (
              <TouchableOpacity
                onPress={onQuickLog}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.quickLogButton}
              >
                <Ionicons name="flash-outline" size={16} color={colors.accent} />
                <Text style={styles.quickLogText}>Log</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    minHeight: 56,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: colors.accent,
    backgroundColor: colors.selectedBg,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 56,
  },
  accentBar: {
    width: 4,
    backgroundColor: colors.accent,
  },
  pressableRow: {
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  leadSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lastDoneText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  noteSnippet: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  quickLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginLeft: 10,
  },
  quickLogText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  cardPressed: {
    opacity: 0.7,
  },
});