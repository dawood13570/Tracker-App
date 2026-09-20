import { TaskRow } from '@/db/queries';
import { colors } from '@/theme/colors';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface GoalCardProps {
  task: TaskRow;
  scopeLabel: 'week' | 'month' | 'year' | 'custom';
  effectiveProgress?: number;
  completedOccurrences?: number;
  subtaskCounts?: { completed: number; total: number };
  selectionMode?: boolean;
  isSelected?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}
  

export function GoalCard({ task, scopeLabel, effectiveProgress = 0, completedOccurrences = 0, subtaskCounts, selectionMode, isSelected, onPress, onLongPress }: GoalCardProps) {
  const isDone = Boolean(task.isCompleted);
  let metaLine = `${task.priority} priority`;
  let percent = 0;
  const hasProgress = task.totalProgress != null && task.totalProgress > 0;
  const hasOccurrenceTarget = task.occurrenceTarget != null && task.occurrenceTarget > 0;
  const periodWord = scopeLabel === 'custom' ? 'period' : scopeLabel;
  
  if (hasProgress && hasOccurrenceTarget) {
    // Progression + occurrence-repeat combo
    percent = task.occurrenceTarget! > 0 ? Math.min(1, completedOccurrences / task.occurrenceTarget!) : 0;
    metaLine = `${effectiveProgress}/${task.totalProgress} ${task.progressUnit ?? ''} · ${completedOccurrences}/${task.occurrenceTarget} runs this ${periodWord} · ${task.priority}`;
  } else if (hasProgress) {
    const target = task.totalProgress!;
    percent = target > 0 ? Math.min(1, effectiveProgress / target) : 0;
    metaLine = `${effectiveProgress}/${target} ${task.progressUnit ?? ''} this ${periodWord} · ${task.priority}`;
  } else if (subtaskCounts && subtaskCounts.total > 0) {
    percent = subtaskCounts.total > 0 ? subtaskCounts.completed / subtaskCounts.total : 0;
    metaLine = `${subtaskCounts.completed}/${subtaskCounts.total} milestones · ${task.priority}`;
  } else if (hasOccurrenceTarget) {
    const target = task.occurrenceTarget!;
    percent = target > 0 ? Math.min(1, completedOccurrences / target) : 0;
    metaLine = `${completedOccurrences}/${target} times this ${periodWord} · ${task.priority}`;
  }

  const showBar = hasProgress || hasOccurrenceTarget || Boolean(subtaskCounts && subtaskCounts.total > 0);



  return (
    <TouchableOpacity style={[styles.card, isSelected && styles.cardSelected]} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.rowLayout}>
        {selectionMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
        <View style={{ flex: 1, marginLeft: selectionMode ? 10 : 0 }}>
          <Text style={[styles.title, isDone && styles.titleDone]}>{isDone ? '✓ ' : '• '}{task.title}</Text>
          <Text style={styles.meta}>{metaLine}</Text>
          {showBar && (
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(percent * 100)}%` }]} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceElevated, padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: colors.accent },
  cardSelected: { borderColor: colors.accent, borderWidth: 1.5 },
  rowLayout: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.accent, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  checkboxChecked: { backgroundColor: colors.accent },
  checkmark: { color: colors.textOnAccent ?? '#fff', fontSize: 10, fontWeight: 'bold' },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceSubtle, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
});