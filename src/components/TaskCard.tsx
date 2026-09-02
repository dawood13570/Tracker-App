// src/components/TaskCard.tsx
import type { PaceResult } from '@/engine/pace';
import { getEffectivePriority } from '@/engine/priority';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSubtasksByParent, getTagsForTask } from '../db/queries';
import { Task, useTaskStore } from '../store/taskStore';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';
import { PaceIndicator } from './PaceIndicator';
import { ProcrastinationBadge } from './ProcrastinationBadge';
import { ProgressBar } from './ProgressBar';

interface TaskCardProps {
  task: Task;
  onToggle: (id: number, currentStatus: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  currentProgress?: number;
  onOpenProgressLog?: (task: Task) => void;
  subtaskCount?: { completed: number; total: number };
  pace?: PaceResult;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSubtasksCountUpdate?: (taskId: number, completed: number, total: number) => void;
}

function getPriorityAccentColor(priority: 'Low' | 'Medium' | 'High') {
  switch (priority) {
    case 'High':
      return colors.priorityHighBorder;
    case 'Medium':
      return colors.priorityMediumBorder;
    default:
      return colors.priorityLowBorder;
  }
}

export function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
  currentProgress,
  onOpenProgressLog,
  subtaskCount,
  pace,
  isExpanded = false,
  onToggleExpand,
  onSubtasksCountUpdate,
}: TaskCardProps) {
  const { evolvingPriorityEnabled } = useStore();
  const { toggleTask } = useTaskStore();

  const [subtasks, setSubtasks] = useState<Task[]>([]);

  const [taskTags, setTaskTags] = useState<{ id: number; name: string; color: string | null }[]>([]);

  useEffect(() => {
    getTagsForTask(task.id).then(setTaskTags);
  }, [task.id]);

  const loadSubtasks = async () => {
    if (task.type === 'Hybrid') {
      const items = await getSubtasksByParent(task.id);
      setSubtasks(items);
    }
  };

  useEffect(() => {
    if (task.type === 'Hybrid' && isExpanded) {
      loadSubtasks();
    }
  }, [task.id, task.isCompleted, isExpanded]);

  const handleToggleSubtask = async (subtaskId: number) => {
    const updatedSubtasks = subtasks.map((s) =>
      s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    setSubtasks(updatedSubtasks);

    const completed = updatedSubtasks.filter((s) => s.isCompleted).length;
    const total = updatedSubtasks.length;
    if (onSubtasksCountUpdate) {
      onSubtasksCountUpdate(task.id, completed, total);
    }

    await toggleTask(subtaskId);
  };

  const effectivePriority = evolvingPriorityEnabled
    ? getEffectivePriority({
        priority: task.priority,
        procrastinationCount: task.procrastinationCount ?? 0,
      })
    : task.priority;

  const displayedProgress = currentProgress ?? task.currentProgress ?? 0;

  const handleLongPress = () => {
    Alert.alert(
      'Task Options',
      'Choose an action for this task',
      [
        { text: 'Edit', onPress: () => onEdit(task) },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete() },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Are you sure?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(task.id) },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={[styles.taskCard, task.isCompleted && styles.completedCard]}>
      <View style={styles.cardInner}>
        <View
          style={[
            styles.priorityAccent,
            { backgroundColor: getPriorityAccentColor(effectivePriority) },
            !task.isCompleted && effectivePriority === 'High' && styles.priorityAccentHighGlow,
          ]}
        />

        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => onToggle(task.id, task.isCompleted)}
            onLongPress={handleLongPress}
            style={({ pressed }) => [pressed && styles.cardPressed]}

          >
            <View style={styles.cardRow}>
              <View style={styles.cardContent}>
          {/* Checkbox + Title Row */}
          <View style={styles.checkboxRow}>
            <View style={[styles.checkbox, task.isCompleted && styles.checkboxChecked]}>
              {task.isCompleted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.taskTitle, task.isCompleted && styles.completedText]}>
              {task.title}
            </Text>
          </View>

          {taskTags.length > 0 && (
            <View style={styles.tagRow}>
              {taskTags.map((tag) => (
                <View key={tag.id} style={[styles.tagChip, { backgroundColor: tag.color ?? colors.surfaceElevated }]}>
                  <Text style={styles.tagChipText}>{tag.name}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.metaRow}>
            {/* "✅ DONE" removed */}
            {task.procrastinationCount && task.procrastinationCount > 0 ? (
              <ProcrastinationBadge count={task.procrastinationCount} />
            ) : null}
          </View>
                {task.type === 'Hybrid' && subtaskCount && (
                  <View style={styles.hybridBadge}>
                    <Text style={styles.hybridBadgeText}>
                      {subtaskCount.completed}/{subtaskCount.total} done
                    </Text>
                  </View>
                )}

                {task.type === 'Progression' &&
                  task.totalProgress !== null &&
                  task.totalProgress !== undefined && (
                    <>
                      <ProgressBar
                        current={displayedProgress}
                        target={task.totalProgress}
                        unit={task.progressUnit}
                      />

                      {task.surplusMode === 'bank_it' && (task.bufferDays ?? 0) > 0 && (
                        <View style={styles.bankedBadge}>
                          <Text style={styles.bankedBadgeText}>
                            {task.bufferDays} {task.bufferDays === 1 ? 'day' : 'days'} banked
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                {task.type === 'Progression' && pace && <PaceIndicator status={pace.status} />}
              </View>

              {task.type === 'Hybrid' && (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={onToggleExpand}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.arrowIcon, isExpanded && styles.arrowIconExpanded]}>
                    {isExpanded ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
              )}

              {task.type === 'Progression' && (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => onOpenProgressLog && onOpenProgressLog(task)}
                >
                  <Text style={styles.arrowIcon}>✎</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>

          {task.type === 'Hybrid' && isExpanded && (
            <View style={styles.inlineSubtaskContainer}>
              <View style={styles.inlineDivider} />

              {subtasks.length === 0 ? (
                <Text style={styles.emptySubtasksText}>
                  No subtasks. Hold and edit task to add subtasks.
                </Text>
              ) : (
                subtasks.map((sub) => (
                  <View key={sub.id} style={styles.subtaskItemRow}>
                    <TouchableOpacity
                      style={styles.subtaskCheckRow}
                      onPress={() => handleToggleSubtask(sub.id)}
                    >
                      <View
                        style={[
                          styles.subtaskCheckbox,
                          sub.isCompleted && styles.subtaskCheckboxChecked,
                        ]}
                      >
                        {sub.isCompleted && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text
                        style={[
                          styles.subtaskTitleText,
                          sub.isCompleted && styles.subtaskCompletedText,
                        ]}
                        numberOfLines={2}
                      >
                        {sub.title}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 1.41,
    elevation: 2,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  priorityAccent: {
    width: 4,
  },
  priorityAccentHighGlow: {
    width: 5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardContent: {
    flex: 1,
  },
  expandButton: {
    paddingLeft: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 14,
    color: colors.textMuted,
  },
  arrowIconExpanded: {
    color: colors.accent,
  },
  completedCard: {
    backgroundColor: colors.completedBg,
    shadowOpacity: 0.05,
    elevation: 0.5,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: colors.completedText,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  hybridBadge: {
    marginTop: 8,
    backgroundColor: colors.hybridBadgeBg,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hybridBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.hybridBadgeText,
  },
  bankedBadge: {
    marginTop: 6,
    backgroundColor: colors.bankedBadgeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  bankedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.bankedBadgeText,
  },
  inlineSubtaskContainer: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  inlineDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginBottom: 8,
  },
  emptySubtasksText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  subtaskItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  subtaskCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subtaskCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  subtaskCheckboxChecked: {
    backgroundColor: colors.accent,
  },
  checkmark: {
    color: colors.textOnAccent,
    fontSize: 10,
    fontWeight: 'bold',
  },
  subtaskTitleText: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
  },
  subtaskCompletedText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  cardPressed: {
  opacity: 0.7,
  },
  tagRow: { 
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 4,
  marginTop: 4 
  },
  tagChip: { 
  paddingHorizontal: 8, 
  paddingVertical: 2, 
  borderRadius: 10 
  },
  tagChipText: { 
  fontSize: 10, 
  fontWeight: '600', 
  color: colors.textPrimary 
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
  },
  
});