import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HabitWithStatus } from '../store/habitStore';
import { colors } from '../theme/colors';
import { SelectionIndicator } from './SelectionIndicator';

type HabitCardProps = {
  habit: HabitWithStatus;
  onLogToday: (habitId: number) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onLongPressCard?: () => void;
  onToggleSelect?: () => void;
};

export function HabitCard({
  habit,
  onLogToday,
  selectionMode = false,
  isSelected = false,
  onLongPressCard,
  onToggleSelect,
}: HabitCardProps) {
  const isWeekly = habit.cadenceType === 'weekly_n_times';
  const weeklyMet =
    isWeekly && habit.weeklyProgress
      ? habit.weeklyProgress.current >= habit.weeklyProgress.target
      : false;

  const handlePress = () => {
    if (selectionMode) {
      onToggleSelect?.();
    } else {
      onLogToday(habit.id);
    }
  };

  const handleLongPress = () => {
    if (!selectionMode && onLongPressCard) {
      onLongPressCard();
    }
  };

  return (
    <View
      style={[
        styles.card,
        habit.isCompletedToday && styles.cardCompleted,
        isSelected && styles.cardSelected,
      ]}
      collapsable={false}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={({ pressed }) => [styles.pressableContainer, pressed && styles.cardPressed]}
      >
        <View style={styles.leftAccent} />

        <View style={styles.leadSlot}>
          {selectionMode ? (
            <SelectionIndicator isSelected={isSelected} />
          ) : (
            <View style={styles.leadPlaceholder} />
          )}
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, habit.isCompletedToday && styles.titleCompleted]}>
            {habit.title}
          </Text>

          {isWeekly ? (
            <Text style={[styles.subtext, weeklyMet && styles.subtextMet]}>
              {habit.weeklyProgress?.current ?? 0}/{habit.weeklyProgress?.target ?? 0} this week
            </Text>
          ) : (
            <Text style={styles.subtext}>
              {habit.isCompletedToday ? 'Done today' : 'Not logged today'}
            </Text>
          )}
        </View>

        {!selectionMode && habit.streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {habit.streak}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginVertical: 6,
    minHeight: 56,
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pressableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 56,
    paddingVertical: 12,
    paddingRight: 14,
  },
  cardPressed: { opacity: 0.7 },
  cardCompleted: { backgroundColor: colors.successBg },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.selectedBg ?? colors.surface,
  },
  leftAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.habitAccent,
    marginRight: 12,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  leadSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  leadPlaceholder: {
    width: 20,
    height: 20,
  },
  content: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  titleCompleted: { color: colors.success },
  subtext: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  subtextMet: { color: colors.success, fontWeight: '600' },
  streakBadge: { marginLeft: 8 },
  streakText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
});