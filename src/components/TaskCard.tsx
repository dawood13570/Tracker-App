import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { postponeTask, skipTask } from '../db/lifecycle';
import { requestProgressChange } from '../services/progress';
import { reportError } from '../utils/errors';
import { useBankedDay } from '../db/lifecycle';
import { useAppDay } from '../hooks/use-app-day';
import type { PaceResult } from '@/engine/pace';
import { getEffectivePriority } from '@/engine/priority';
import { taskHasProgress } from '@/engine/taskShape';
import { useTagStore } from '@/store/tagStore';
import { useColors } from '@/store/themeStore';
import type { Palette } from '@/theme/colors';
import { getAppToday } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getSubtasksByParentOrdered,
  getTagsForTask,
  revertToPreviousProgress,
  setAbsoluteProgress,
  updateTask,
} from '../db/queries';
import { Task, useTaskStore } from '../store/taskStore';
import { useStore } from '../store/useStore';
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

function getPriorityAccentColor(colors: Palette, priority: 'Low' | 'Medium' | 'High') {
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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    evolvingPriorityEnabled,
    skipProgressionAlerts,
    setSkipProgressionAlerts,
  } = useStore();
  const { toggleTask } = useTaskStore();
  const tagVersion = useTagStore((state) => state.tagVersion);

  // If this task is a daily portal to a macro goal, pull subtasks from the master source
  const targetParentId = task.id;

  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [taskTags, setTaskTags] = useState<{ id: number; name: string; color: string | null }[]>([]);
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [subtaskInputText, setSubtaskInputText] = useState<string>('');
  const [localSubtaskProg, setLocalSubtaskProg] = useState<Record<number, number>>({});

  const isSubmittingSubtask = useRef(false);

  const todayStr = useAppDay();
  const isOverdueProxy =
    !task.isCompleted &&
    task.sourceTaskId != null &&
    !task.rolloverEnabled &&
    task.scheduledDate < todayStr;

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
    if (isExpanded) {
      getSubtasksByParentOrdered(targetParentId).then((items) => {
        if (active) {
          setSubtasks(items ?? []);
          const initialMap: Record<number, number> = {};
          (items ?? []).forEach((st) => {
            initialMap[st.id] = st.currentProgress ?? 0;
          });
          setLocalSubtaskProg(initialMap);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [targetParentId, task.isCompleted, isExpanded]);

  const isSubtaskLocked = (index: number): boolean => {
    if (!task.isSequential) return false;
    // Locked if any prior subtask in the sequence is incomplete
    for (let i = 0; i < index; i++) {
      if (!subtasks[i].isCompleted) return true;
    }
    return false;
  };

  const handleToggleSubtask = async (subtaskId: number, index: number) => {
    if (isSubtaskLocked(index)) {
      Alert.alert('Sequential task', 'Complete the previous milestone first.');
      return;
    }

    const sub = subtasks.find((s) => s.id === subtaskId);
    if (!sub) return;

    const nextCompleted = !sub.isCompleted;
    const total = sub.totalProgress ?? 0;

    let nextProg = localSubtaskProg[subtaskId] ?? sub.currentProgress ?? 0;

    if (taskHasProgress(sub)) {
      if (nextCompleted) {
        nextProg = total > 0 ? total : nextProg;
        await setAbsoluteProgress(subtaskId, nextProg);
      } else {
        nextProg = await revertToPreviousProgress(subtaskId);
      }
      setLocalSubtaskProg((prev) => ({ ...prev, [subtaskId]: nextProg }));
    }

    const updated = subtasks.map((s) =>
      s.id === subtaskId
        ? { ...s, isCompleted: nextCompleted, currentProgress: nextProg }
        : s
    );
    setSubtasks(updated);

    const completed = updated.filter((s) => s.isCompleted).length;
    if (onSubtasksCountUpdate) {
      onSubtasksCountUpdate(task.id, completed, updated.length);
    }

    if (!taskHasProgress(sub)) await toggleTask(subtaskId);
    onProgressChanged?.();
  };

  const handleSubtaskProgressSubmit = async (subtaskId: number, total: number, rawVal: string) => {
    if (isSubmittingSubtask.current) return;
    isSubmittingSubtask.current = true;

    const parsed = Number(rawVal);
    const sub = subtasks.find((s) => s.id === subtaskId);

    setEditingSubtaskId(null);
    Keyboard.dismiss();

    if (Number.isNaN(parsed) || !sub) {
      isSubmittingSubtask.current = false;
      return;
    }

    const clamped = Math.max(0, Math.round(parsed));

    setLocalSubtaskProg((prev) => ({ ...prev, [subtaskId]: clamped }));
    await setAbsoluteProgress(subtaskId, clamped);

    const shouldComplete = total > 0 && clamped >= total;
    const needsStatusToggle = sub.isCompleted !== shouldComplete;



    const updated = subtasks.map((s) =>
      s.id === subtaskId
        ? { ...s, currentProgress: clamped, isCompleted: shouldComplete }
        : s
    );
    setSubtasks(updated);

    const completedCount = updated.filter((s) => s.isCompleted).length;
    if (onSubtasksCountUpdate) {
      onSubtasksCountUpdate(task.id, completedCount, updated.length);
    }

    onProgressChanged?.();

    setTimeout(() => {
      isSubmittingSubtask.current = false;
    }, 100);
  };

  const effectivePriority = evolvingPriorityEnabled
    ? getEffectivePriority({
        priority: task.priority,
        procrastinationCount: task.procrastinationCount ?? 0,
      })
    : task.priority;

  const displayedProgress = currentProgress ?? task.currentProgress ?? 0;
  const hasSubtasks = Boolean(subtaskCount && subtaskCount.total > 0);

  const executeComplete = async () => {
    const total = task.totalProgress ?? 1;
    await setAbsoluteProgress(task.id, total);

    onProgressChanged?.();
  };

  const executeUndo = async () => {
    await revertToPreviousProgress(task.id);

    onProgressChanged?.();
  };

  const handleProgressionToggle = () => {
    const total = task.totalProgress ?? 1;

    if (skipProgressionAlerts) {
      if (!task.isCompleted) {
        executeComplete();
      } else {
        executeUndo();
      }
      return;
    }

    if (!task.isCompleted) {
      Alert.alert(
        'Mark as done?',
        `This sets progress to ${total}/${total} ${task.progressUnit ?? ''}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: "Don't Ask Again",
            onPress: async () => {
              setSkipProgressionAlerts(true);
              await executeComplete();
            },
          },
          {
            text: 'Mark Done',
            style: 'default',
            onPress: executeComplete,
          },
        ]
      );
    } else {
      Alert.alert(
        'Undo completion?',
        'This will revert to your last recorded milestone and mark the task as incomplete.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: "Don't Ask Again",
            onPress: async () => {
              setSkipProgressionAlerts(true);
              await executeUndo();
            },
          },
          {
            text: 'Undo',
            style: 'destructive',
            onPress: executeUndo,
          },
        ]
      );
    }
  };

  const progressBusy = useRef(false);
  const handleSliderUpdate = async (taskId: number, val: number) => {
    if (progressBusy.current) return;
    progressBusy.current = true;
    try { if (await requestProgressChange(taskId, val)) onProgressChanged?.(); }
    catch (error) { reportError(error); }
    finally { progressBusy.current = false; }
  };

  const handleParentToggle = async () => {
    const nextCompleted = !task.isCompleted;
    await onToggle(task.id, task.isCompleted);

    if (hasSubtasks) {
      if (isExpanded) {
        const refreshed = await getSubtasksByParentOrdered(targetParentId);
        setSubtasks(refreshed ?? []);
        const newMap: Record<number, number> = {};
        (refreshed ?? []).forEach((s) => {
          newMap[s.id] = s.currentProgress ?? 0;
        });
        setLocalSubtaskProg(newMap);
      }
    }

    onProgressChanged?.();
  };

  const handlePress = () => {
    if (selectionMode) {
      onToggleSelect();
    } else if (taskHasProgress(task)) {
      handleProgressionToggle();
    } else {
      handleParentToggle();
    }
  };

  const handleLongPress = () => {
    if (!selectionMode) {
      onLongPressCard();
    }
  };

  return (
    <Swipeable enabled={!selectionMode} overshootLeft={false} overshootRight={false} dragOffsetFromLeftEdge={48} dragOffsetFromRightEdge={48}
      renderLeftActions={(_progress, _translation, methods) => <Pressable accessibilityRole="button" accessibilityLabel={task.isCompleted ? 'Reopen task' : 'Complete task'} onPress={() => { methods.close(); handlePress(); }} style={{ padding: 20, justifyContent: 'center', backgroundColor: colors.surfaceSubtle }}><Text style={{ color: colors.accent }}>{task.isCompleted ? 'Reopen' : 'Complete'}</Text></Pressable>}
      renderRightActions={task.isCompleted ? undefined : (_progress, _translation, methods) => <View style={{ justifyContent: 'center', backgroundColor: colors.surfaceSubtle }}><Pressable accessibilityRole="button" accessibilityLabel="Postpone until tomorrow" onPress={() => { try { postponeTask(task.id); methods.close(); onProgressChanged?.(); } catch (error) { reportError(error); } }} style={{ padding: 20, justifyContent: 'center', backgroundColor: colors.surfaceSubtle }}><Text style={{ color: colors.accent }}>Postpone</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Skip this occurrence" onPress={() => { methods.close(); Alert.alert('Skip this occurrence?', 'It stays in history. Repeating tasks schedule their next occurrence.', [{ text: 'Cancel' }, { text: 'Skip', onPress: () => { try { skipTask(task.id); onProgressChanged?.(); } catch (error) { reportError(error); } } }]); }} style={{ minHeight: 44, padding: 12 }}><Text style={{ color: colors.textSecondary }}>Skip</Text></Pressable></View>}
    >
    <View
      style={[
        styles.taskCard,
        task.isCompleted && styles.completedCard,
        isSelected && styles.selectedCard,
      ]}
      collapsable={false}
    >
      <View style={styles.cardInner} collapsable={false}>
        <View
          style={[
            styles.priorityAccent,
            { backgroundColor: getPriorityAccentColor(colors, effectivePriority) },
            !task.isCompleted && effectivePriority === 'High' && styles.priorityAccentHighGlow,
          ]}
        />

        <View style={styles.mainContainer}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={task.title}
            accessibilityState={{ checked: task.isCompleted }}
            accessibilityActions={[{ name: 'activate', label: task.isCompleted ? 'Reopen' : 'Complete' }, { name: 'postpone', label: 'Postpone until tomorrow' }, { name: 'skip', label: 'Skip this occurrence' }]}
            onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') handlePress(); else { try { if (event.nativeEvent.actionName === 'skip') skipTask(task.id); else postponeTask(task.id); onProgressChanged?.(); } catch (error) { reportError(error); } } }}
            onPress={handlePress}
            onLongPress={handleLongPress}
            style={({ pressed }) => [styles.pressableBlock, pressed && styles.cardPressed]}
          >
            {/* Top Row: Checkbox + Title/Badges + Arrow */}
            <View style={styles.headerRow}>
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

              <View style={styles.titleSlot}>
                <Text
                  style={[styles.taskTitle, task.isCompleted && styles.completedText]}
                  numberOfLines={2}
                >
                  {task.title || 'Untitled Task'}
                </Text>
              </View>

              <View style={styles.trailingSlot}>
                {hasSubtasks && (
                  <View style={styles.hybridBadge}>
                    <Text style={styles.hybridBadgeText}>
                      {subtaskCount?.completed ?? 0}/{subtaskCount?.total ?? 0}
                    </Text>
                  </View>
                )}

                {hasSubtasks && (
                  <View
                    style={{ opacity: selectionMode ? 0 : 1 }}
                    pointerEvents={selectionMode ? 'none' : 'auto'}
                  >
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={onToggleExpand}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={[styles.arrowIcon, isExpanded && styles.arrowIconExpanded]}>
                        {isExpanded ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Bottom Meta & Sliders */}
            {(taskTags.length > 0 ||
              Boolean(task.procrastinationCount && task.procrastinationCount > 0) ||
              taskHasProgress(task) ||
              isOverdueProxy) && (
              <View style={styles.detailsBlock}>
                {(taskTags.length > 0 ||
                  Boolean(task.procrastinationCount && task.procrastinationCount > 0) ||
                  isOverdueProxy) && (
                  <View style={styles.tagRow}>
                    {isOverdueProxy && (
                      <View style={styles.overdueBadge}>
                        <Text style={styles.overdueBadgeText}>Missed {task.scheduledDate}</Text>
                      </View>
                    )}
                    {Boolean(task.procrastinationCount && task.procrastinationCount > 0) && (
                      <ProcrastinationBadge count={task.procrastinationCount!} />
                    )}
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

                {taskHasProgress(task) && (
                  <View style={styles.progressContainer}>
                    <ProgressionSlider
                      taskId={task.id}
                      current={displayedProgress}
                      total={task.totalProgress!}
                      unit={task.progressUnit}
                      onUpdate={handleSliderUpdate}
                    />

                    <View style={styles.progressMetaRow}>
                      {Boolean(pace) && <PaceIndicator status={pace!.status} />}
                      {(task.bufferDays ?? 0) > 0 && (
                        <View style={styles.bankedBadge}>
                          <Text style={styles.bankedBadgeText}>
                            {task.bufferDays} {task.bufferDays === 1 ? 'day' : 'days'} banked
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}
          </Pressable>

          {task.skippedAt && <Text style={{ color: colors.textMuted, padding: 12 }}>Skipped · {task.skippedAt.slice(0, 10)}</Text>}

          {!selectionMode && (task.bufferDays ?? 0) > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Use one banked rest day" onPress={() => { try { useBankedDay(task.id); onProgressChanged?.(); } catch (error) { reportError(error); } }} style={{ padding: 12 }}><Text style={{ color: colors.accent }}>Use a banked day</Text></Pressable>}
          {/* Subtasks Accordion */}
          {!selectionMode && hasSubtasks && isExpanded && (
            <View style={styles.inlineSubtaskContainer}>
              <View style={styles.inlineDivider} />
              {subtasks.length === 0 ? (
                <Text style={styles.emptySubtasksText}>
                  No subtasks. Hold and edit task to add subtasks.
                </Text>
              ) : (
                subtasks.map((sub, idx) => {
                  const isProgSubtask = taskHasProgress(sub);
                  const subProg = localSubtaskProg[sub.id] ?? sub.currentProgress ?? 0;
                  const subTotal = sub.totalProgress ?? 0;
                  const isEditingThisSubtask = editingSubtaskId === sub.id;
                  const locked = isSubtaskLocked(idx);

                  return (
                    <View
                      key={sub.id}
                      style={[styles.subtaskItemRow, locked && styles.subtaskLockedRow]}
                    >
                      <TouchableOpacity
                        style={styles.subtaskCheckRow}
                        onPress={() => handleToggleSubtask(sub.id, idx)}
                        disabled={locked}
                      >
                        <View
                          style={[
                            styles.subtaskCheckbox,
                            sub.isCompleted && styles.subtaskCheckboxChecked,
                            locked && styles.subtaskCheckboxLocked,
                          ]}
                        >
                          {locked ? (
                            <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
                          ) : (
                            sub.isCompleted && <Text style={styles.checkmark}>✓</Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.subtaskTitleText,
                            sub.isCompleted && styles.subtaskCompletedText,
                            locked && styles.subtaskLockedText,
                          ]}
                          numberOfLines={2}
                        >
                          {sub.title}
                        </Text>
                      </TouchableOpacity>

                      {isProgSubtask && (
                        <View style={styles.subtaskProgressSlot}>
                          {isEditingThisSubtask ? (
                            <View style={styles.subtaskInputWrapper}>
                              <TextInput
                                style={styles.subtaskInputBox}
                                value={subtaskInputText}
                                onChangeText={setSubtaskInputText}
                                keyboardType="numeric"
                                selectTextOnFocus
                                autoFocus
                                onSubmitEditing={() =>
                                  handleSubtaskProgressSubmit(sub.id, subTotal, subtaskInputText)
                                }
                              />
                              <TouchableOpacity
                                style={styles.confirmSubtaskBtn}
                                onPress={() =>
                                  handleSubtaskProgressSubmit(sub.id, subTotal, subtaskInputText)
                                }
                              >
                                <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <Pressable
                              disabled={locked}
                              style={[
                                styles.subtaskValueBadge,
                                locked && { opacity: 0.5 },
                              ]}
                              onPress={() => {
                                const currentVal = localSubtaskProg[sub.id] ?? subProg;
                                setEditingSubtaskId(sub.id);
                                setSubtaskInputText(String(currentVal));
                              }}
                            >
                              <Text
                                style={[
                                  styles.subtaskValueBadgeText,
                                  sub.isCompleted && styles.subtaskValueBadgeDone,
                                  locked && { color: colors.textMuted },
                                ]}
                              >
                                {localSubtaskProg[sub.id] ?? subProg}/{subTotal} {sub.progressUnit ?? ''}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </View>
    </View>
    </Swipeable>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    taskCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 10,
      elevation: 2,
      width: '100%',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    selectedCard: {
      borderColor: colors.accent,
      backgroundColor: colors.selectedBg ?? colors.surface,
    },
    cardInner: {
      flexDirection: 'row',
      alignItems: 'stretch',
      width: '100%',
    },
    priorityAccent: { width: 4 },
    priorityAccentHighGlow: { width: 5 },
    mainContainer: {
      flex: 1,
      minWidth: 0,
    },
    pressableBlock: {
      padding: 12,
      width: '100%',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    leadSlot: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
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
    titleSlot: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    taskTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 20,
    },
    completedCard: { backgroundColor: colors.completedBg },
    completedText: { textDecorationLine: 'line-through', color: colors.completedText },
    trailingSlot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 8,
    },
    hybridBadge: {
      backgroundColor: colors.hybridBadgeBg,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
    },
    hybridBadgeText: { fontSize: 11, fontWeight: '700', color: colors.hybridBadgeText },
    expandButton: {
      paddingHorizontal: 4,
      paddingVertical: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    arrowIcon: { fontSize: 11, color: colors.textMuted },
    arrowIconExpanded: { color: colors.accent },
    detailsBlock: {
      marginTop: 8,
      paddingLeft: 32,
      width: '100%',
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    tagChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    tagChipText: { fontSize: 10, fontWeight: '600', color: colors.textPrimary },
    progressContainer: {
      width: '100%',
      marginTop: 4,
    },
    progressMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    bankedBadge: {
      backgroundColor: colors.bankedBadgeBg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    bankedBadgeText: { fontSize: 10, fontWeight: '600', color: colors.bankedBadgeText },
    inlineSubtaskContainer: {
      paddingHorizontal: 14,
      paddingBottom: 10,
      paddingLeft: 44,
    },
    inlineDivider: { height: 1, backgroundColor: colors.borderSubtle, marginBottom: 6 },
    emptySubtasksText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', paddingVertical: 4 },
    subtaskItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 5,
      gap: 8,
    },
    subtaskLockedRow: {
      opacity: 0.45,
    },
    subtaskCheckRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    subtaskCheckbox: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
      backgroundColor: colors.surface,
    },
    subtaskCheckboxChecked: { backgroundColor: colors.accent },
    subtaskCheckboxLocked: { borderColor: colors.borderSubtle, backgroundColor: colors.surfaceElevated },
    subtaskTitleText: { fontSize: 13, color: colors.textPrimary, flex: 1 },
    subtaskCompletedText: { textDecorationLine: 'line-through', color: colors.textMuted },
    subtaskLockedText: { color: colors.textMuted },
    subtaskProgressSlot: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    subtaskInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    confirmSubtaskBtn: {
      padding: 4,
    },
    subtaskValueBadge: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    subtaskValueBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.accent,
    },
    subtaskValueBadgeDone: {
      color: colors.textMuted,
      textDecorationLine: 'line-through',
    },
    subtaskInputBox: {
      minWidth: 50,
      height: 26,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 6,
      backgroundColor: colors.surfaceSubtle,
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
      paddingVertical: 0,
      paddingHorizontal: 6,
      textAlign: 'center',
    },
    cardPressed: { opacity: 0.8 },
    leadOverlay: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    overdueBadge: { backgroundColor: colors.dangerBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    overdueBadgeText: { fontSize: 11, fontWeight: '700', color: colors.danger },
  });