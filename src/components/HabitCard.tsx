import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { HabitWithStatus } from '../store/habitStore';
import { colors } from '../theme/colors';

type HabitCardProps = {
  habit: HabitWithStatus;
  onLogToday: (habitId: number) => void;
  onEdit: (habit: HabitWithStatus) => void;
  onDelete: (habitId: number) => void;
};

export function HabitCard({ habit, onLogToday, onEdit, onDelete }: HabitCardProps) {
  const isWeekly = habit.cadenceType === 'weekly_n_times';
  const weeklyMet = isWeekly && habit.weeklyProgress
    ? habit.weeklyProgress.current >= habit.weeklyProgress.target
    : false;

  const handleLongPress = () => {
    Alert.alert(
      'Habit Options',
      'Choose an action for this habit',
      [
        { text: 'Edit', onPress: () => onEdit(habit) },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete() },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Are you sure?',
      'This will delete the habit and all its log history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(habit.id) },
      ],
      { cancelable: true }
    );
  };

  return (
    <Pressable
      onPress={() => onLogToday(habit.id)}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.card,
        habit.isCompletedToday && styles.cardCompleted,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.leftAccent} />

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

      {habit.streak > 0 && (
        <View style={styles.streakBadge}>
          <Text style={styles.streakText}>🔥 {habit.streak}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginVertical: 6,
    paddingVertical: 12,
    paddingRight: 14,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardCompleted: {
    backgroundColor: colors.successBg,
  },
  leftAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.habitAccent,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  titleCompleted: {
    color: colors.success,
  },
  subtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  subtextMet: {
    color: colors.success,
    fontWeight: '600',
  },
  streakBadge: {
    marginLeft: 8,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});