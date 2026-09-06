//TaskCard.tsx
import type { PaceResult } from '@/engine/pace';
import { getEffectivePriority } from '@/engine/priority';
import { useTagStore } from '@/store/tagStore';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSubtasksByParent, getTagsForTask, setAbsoluteProgress } from '../db/queries';
import { Task, useTaskStore } from '../store/taskStore';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';
import { PaceIndicator } from './PaceIndicator';
import { ProcrastinationBadge } from './ProcrastinationBadge';
import { ProgressionSlider } from './ProgressionSlider';
import { SelectionIndicator } from './SelectionIndicator';

interface TaskCardProps {
  task: Task;
  onToggle: (id: number, currentStatus: boolean) => void;
  onProgressChanged?: () => void;
  currentProgress?: number;
  subtaskCount?: { completed: number; total: number };
  pace?: PaceResult;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSubtasksCountUpdate?: (taskId: number, completed: number, total: number) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onLongPressCard: () => void;
  onToggleSelect: () => void;

}

function getPriorityAccentColor(priority: 'Low' | 'Medium' | 'High') {
  switch (priority) {
    case 'High':
      return colors.priorityHighBorder ?? '#ef4444';
    case 'Medium':
      return colors.priorityMediumBorder ?? '#eab308';
    default:
      return colors.priorityLowBorder ?? '#22c55e';
  }
}

export function TaskCard({
  task,
  onToggle,
  onProgressChanged,
  currentProgress,
  subtaskCount,
  pace,
  isExpanded = false,
  onToggleExpand,
  onSubtasksCountUpdate,
  selectionMode,
  isSelected,
  onLongPressCard,
  onToggleSelect,
}: TaskCardProps) {
  const { evolvingPriorityEnabled } = useStore();
  const { toggleTask } = useTaskStore();
  const tagVersion = useTagStore((state) => state.tagVersion);

  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [taskTags, setTaskTags] = useState<{ id: number; name: string; color: string | null }[]>([]);

  useEffect(() => {
    let active = true;
    getTagsForTask(task.id).then((tags) => {
      if (active) setTaskTags(tags ?? []);
    });
    return () => {
      active = false;
    };
  }, [task.id, tagVersion]);

  useEffect(() => {
    let active = true;
    if (task.type === 'Hybrid' && isExpanded) {
      getSubtasksByParent(task.id).then((items) => {
        if (active) setSubtasks(items ?? []);
      });
    }
    return () => {
      active = false;
    };
  }, [task.id, task.isCompleted, isExpanded, task.type]);

  const handleToggleSubtask = async (subtaskId: number) => {
    const updated = subtasks.map((s) => (s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s));
    setSubtasks(updated);
    const completed = updated.filter((s) => s.isCompleted).length;
    if (onSubtasksCountUpdate) {
      onSubtasksCountUpdate(task.id, completed, updated.length);
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

  const handleProgressionToggle = () => {
  if (!task.isCompleted) {
    Alert.alert(
      'Mark as done?',
      `This sets progress to ${task.totalProgress}/${task.totalProgress} ${task.progressUnit ?? ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Done',
          onPress: async () => {
            if (task.totalProgress != null) {
              await setAbsoluteProgress(task.id, task.totalProgress);
            }
            onToggle(task.id, task.isCompleted);
            onProgressChanged?.();
          },
        },
      ]
    );
  } else {
    Alert.alert('Undo completion?', 'This will mark the task as not done.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Undo', style: 'destructive', onPress: () => onToggle(task.id, task.isCompleted) },
    ]);
  }
};

const handleSliderUpdate = async (taskId: number, val: number) => {
  const total = task.totalProgress ?? 0;
  if (task.isCompleted && val < total) {
    Alert.alert('Undo completion?', 'Reducing progress will mark this task as not done.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: async () => {
          await setAbsoluteProgress(taskId, val);
          onToggle(taskId, task.isCompleted);
          onProgressChanged?.();
        },
      },
    ]);
  } else {
    await setAbsoluteProgress(taskId, val);
    onProgressChanged?.();
  }
};

const handlePress = () => {
  if (selectionMode) {
    onToggleSelect();
  } else if (task.type === 'Progression' && task.totalProgress != null) {
    handleProgressionToggle();
  } else {
    onToggle(task.id, task.isCompleted);
  }
};

  const handleLongPress = () => {
    if (!selectionMode) {
      onLongPressCard();
    }
  };

  return (
    <View
      style={[
        styles.taskCard,
        task.isCompleted && styles.completedCard,
        isSelected && styles.taskCard,
      ]}
      collapsable={false}
    >
      <View style={styles.cardInner} collapsable={false}>
        <View
          style={[
            styles.priorityAccent,
            { backgroundColor: getPriorityAccentColor(effectivePriority) },
            !task.isCompleted && effectivePriority === 'High' && styles.priorityAccentHighGlow,
          ]}
        />

        <View style={styles.mainContainer}>
          <Pressable
            onPress={handlePress}
            onLongPress={handleLongPress}
            style={({ pressed }) => [styles.pressableRow, pressed && styles.cardPressed]}
          >
            <View style={styles.cardRow}>
              <View style={styles.leadSlot}>
                <View
                  style={[styles.leadOverlay, { opacity: selectionMode ? 1 : 0 }]}
                  pointerEvents={selectionMode ? 'auto' : 'none'}
                >
                  <SelectionIndicator isSelected={isSelected} />
                </View>

                <View
                  style={[styles.leadOverlay, { opacity: selectionMode ? 0 : 1 }]}
                  pointerEvents={selectionMode ? 'none' : 'auto'}
                >
                  <View style={[styles.checkbox, task.isCompleted && styles.checkboxChecked]}>
                    {task.isCompleted && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </View>
              </View>

              <View style={styles.cardContent}>
                <Text
                  style={[styles.taskTitle, task.isCompleted && styles.completedText]}
                  numberOfLines={2}
                >
                  {task.title || 'Untitled Task'}
                </Text>

                {taskTags.length > 0 && (
                  <View style={styles.tagRow}>
                    {taskTags.map((tag) => (
                      <View
                        key={tag.id}
                        style={[styles.tagChip, { backgroundColor: tag.color ?? colors.surfaceElevated }]}
                      >
                        <Text style={styles.tagChipText}>{tag.name}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {Boolean(task.procrastinationCount && task.procrastinationCount > 0) && (
                  <View style={styles.metaRow}>
                    <ProcrastinationBadge count={task.procrastinationCount!} />
                  </View>
                )}

                {task.type === 'Hybrid' && Boolean(subtaskCount) && (
                  <View style={styles.hybridBadge}>
                    <Text style={styles.hybridBadgeText}>
                      {subtaskCount?.completed ?? 0}/{subtaskCount?.total ?? 0} done
                    </Text>
                  </View>
                )}

                {task.type === 'Progression' &&
  task.totalProgress !== null &&
  task.totalProgress !== undefined && (
    <View style={{ marginTop: 6, width: '100%' }}>
      <ProgressionSlider
        taskId={task.id}
        current={displayedProgress}
        total={task.totalProgress}
        unit={task.progressUnit}
        onUpdate={handleSliderUpdate}
      />
      {task.surplusMode === 'bank_it' && (task.bufferDays ?? 0) > 0 && (
        <View style={styles.bankedBadge}>
          <Text style={styles.bankedBadgeText}>
            {task.bufferDays} {task.bufferDays === 1 ? 'day' : 'days'} banked
          </Text>
        </View>
      )}
    </View>
  )}

                {task.type === 'Progression' && Boolean(pace) && (
                  <View style={{ marginTop: 4 }}>
                    <PaceIndicator status={pace!.status} />
                  </View>
                )}
              </View>

              {task.type === 'Hybrid' && (
                <View
                  style={{ opacity: selectionMode ? 0 : 1 }}
                  pointerEvents={selectionMode ? 'none' : 'auto'}
                >
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={onToggleExpand}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.arrowIcon, isExpanded && styles.arrowIconExpanded]}>
                      {isExpanded ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Pressable>

          {!selectionMode && task.type === 'Hybrid' && isExpanded && (
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
    elevation: 2,
    minHeight: 60,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  selectedCard: {
    borderColor: colors.accent,
    backgroundColor: colors.selectedBg ?? colors.surface,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 60,
    width: '100%',
  },
  priorityAccent: { width: 4 },
  priorityAccentHighGlow: { width: 5 },
  mainContainer: {
    flex: 1,
    minWidth: 0,
  },
  pressableRow: {
    width: '100%',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    width: '100%',
  },
  leadSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
  },
  checkmark: {
    color: colors.textOnAccent ?? '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  expandButton: { paddingLeft: 12, paddingVertical: 8, justifyContent: 'center', alignItems: 'center' },
  arrowIcon: { fontSize: 14, color: colors.textMuted },
  arrowIconExpanded: { color: colors.accent },
  completedCard: { backgroundColor: colors.completedBg },
  completedText: { textDecorationLine: 'line-through', color: colors.completedText },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  hybridBadge: { marginTop: 8, backgroundColor: colors.hybridBadgeBg, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  hybridBadgeText: { fontSize: 11, fontWeight: '600', color: colors.hybridBadgeText },
  bankedBadge: { marginTop: 6, backgroundColor: colors.bankedBadgeBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  bankedBadgeText: { fontSize: 11, fontWeight: '600', color: colors.bankedBadgeText },
  inlineSubtaskContainer: { marginTop: 10, paddingHorizontal: 16, paddingBottom: 12 },
  inlineDivider: { height: 1, backgroundColor: colors.borderSubtle, marginBottom: 8 },
  emptySubtasksText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', paddingVertical: 4 },
  subtaskItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  subtaskCheckRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  subtaskCheckbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginRight: 8, backgroundColor: colors.surface },
  subtaskCheckboxChecked: { backgroundColor: colors.accent },
  subtaskTitleText: { fontSize: 13, color: colors.textPrimary, flex: 1 },
  subtaskCompletedText: { textDecorationLine: 'line-through', color: colors.textMuted },
  cardPressed: { opacity: 0.7 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tagChipText: { fontSize: 10, fontWeight: '600', color: colors.textPrimary },
  leadOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});