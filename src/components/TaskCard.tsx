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
import { getSubtasksByParent } from '../db/queries';
import { Task, useTaskStore } from '../store/taskStore';
import { useStore } from '../store/useStore';
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
    // 1. Optimistic instant UI update
    const updatedSubtasks = subtasks.map((s) =>
      s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    setSubtasks(updatedSubtasks);

    const completed = updatedSubtasks.filter((s) => s.isCompleted).length;
    const total = updatedSubtasks.length;
    if (onSubtasksCountUpdate) {
      onSubtasksCountUpdate(task.id, completed, total);
    }

    // 2. Persist in background
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
      <Pressable
        onPress={() => onToggle(task.id, task.isCompleted)}
        onLongPress={handleLongPress}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardContent}>
            <Text style={[styles.taskTitle, task.isCompleted && styles.completedText]}>
              {task.title}
            </Text>

            <View style={styles.metaRow}>
              <Text style={styles.taskMeta}>
                {task.isCompleted ? '✅ DONE • ' : ''}
                {task.type.toUpperCase()} •{' '}
                <Text
                  style={
                    !task.isCompleted && effectivePriority === 'High'
                      ? styles.highPriorityIncomplete
                      : undefined
                  }
                >
                  {effectivePriority.toUpperCase()}
                </Text>
              </Text>

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

      {/* Inline Subtasks Accordion (Checklist only) */}
      {task.type === 'Hybrid' && isExpanded && (
        <View style={styles.inlineSubtaskContainer}>
          <View style={styles.inlineDivider} />

          {subtasks.length === 0 ? (
            <Text style={styles.emptySubtasksText}>No subtasks. Hold and edit task to add subtasks.</Text>
          ) : (
            subtasks.map((sub) => (
              <View key={sub.id} style={styles.subtaskItemRow}>
                <TouchableOpacity
                  style={styles.subtaskCheckRow}
                  onPress={() => handleToggleSubtask(sub.id)}
                >
                  <View style={[styles.subtaskCheckbox, sub.isCompleted && styles.subtaskCheckboxChecked]}>
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
  );
}

export const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    color: '#888888',
  },
  arrowIconExpanded: {
    color: '#1c8db9',
  },
  completedCard: {
    backgroundColor: '#d6d6d6',
    shadowOpacity: 0.05,
    elevation: 0.5,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  highPriorityIncomplete: {
    color: '#d21818',
    fontWeight: '800',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskMeta: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  hybridBadge: {
    marginTop: 8,
    backgroundColor: '#E1F5FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hybridBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0288D1',
  },
  bankedBadge: {
    marginTop: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  bankedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
  },
  inlineSubtaskContainer: {
    marginTop: 10,
  },
  inlineDivider: {
    height: 1,
    backgroundColor: '#ececec',
    marginBottom: 8,
  },
  emptySubtasksText: {
    fontSize: 12,
    color: '#888',
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
    borderColor: '#1c8db9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  subtaskCheckboxChecked: {
    backgroundColor: '#1c8db9',
  },
  checkmark: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  subtaskTitleText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  subtaskCompletedText: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
});