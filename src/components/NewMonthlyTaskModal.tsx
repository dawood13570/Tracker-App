// src/components/NewMonthlyTaskModal.tsx
import { useTagStore } from '@/store/tagStore';
import { useColors } from '@/store/themeStore';
import { Palette } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  assignTag,
  deleteTask,
  getSubtasksByParent,
  insertSubtask,
  insertTask,
  updateTask,
} from '../db/queries';
import { PursuitPicker } from './PursuitPicker';
import { TagPicker } from './TagPicker';

interface SubTaskDraft {
  id: string;
  title: string;
  isCompleted: boolean;
  isNew?: boolean;
}

interface NewMonthlyTaskModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  monthStartDate: string;
  monthEndDate: string;
  editTask?: any | null;
  onTaskCreated: () => void;
  onClose?: () => void;
}

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

export default function NewMonthlyTaskModal({
  sheetRef,
  monthStartDate,
  monthEndDate,
  editTask,
  onTaskCreated,
  onClose,
}: NewMonthlyTaskModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [selectedPursuitId, setSelectedPursuitId] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [hasProgress, setHasProgress] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');

  const [hasMilestones, setHasMilestones] = useState(false);
  const [isSequential, setIsSequential] = useState(true);
  const [subtasks, setSubtasks] = useState<SubTaskDraft[]>([]);
  const [deletedSubtaskIds, setDeletedSubtaskIds] = useState<number[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const [isRecurringGoal, setIsRecurringGoal] = useState(true);
  const [occurrenceCount, setOccurrenceCount] = useState('');
  const [maxGapDays, setMaxGapDays] = useState(1);

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();
  const snapPoints = useMemo(() => ['85%', '55%'], []);

  const formattedMonthLabel = useMemo(() => {
    try {
      return format(parseISO(monthStartDate), 'MMMM yyyy');
    } catch {
      return `${monthStartDate} – ${monthEndDate}`;
    }
  }, [monthStartDate, monthEndDate]);

  // Calculate the remaining active window from today (or start date if future)
  const remainingDaysInPeriod = useMemo(() => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const start = monthStartDate > todayStr ? parseISO(monthStartDate) : parseISO(todayStr);
      const end = parseISO(monthEndDate);
      return Math.max(1, differenceInCalendarDays(end, start) + 1);
    } catch {
      return 30;
    }
  }, [monthStartDate, monthEndDate]);

  // Strict dynamic cap: with n occurrences in the remaining days, max gap is floor(remainingDays / n)
  const maxPossibleGap = useMemo(() => {
    const n = Number(occurrenceCount);
    if (!n || n <= 0) return remainingDaysInPeriod;
    return Math.max(1, Math.floor(remainingDaysInPeriod / n));
  }, [occurrenceCount, remainingDaysInPeriod]);

  useEffect(() => {
    setMaxGapDays((prev) => Math.max(1, Math.min(prev, maxPossibleGap)));
  }, [maxPossibleGap]);

  const hasAnyMilestones = subtasks.length > 0;

  const handleToggleProgress = (value: boolean) => {
    if (value && (hasMilestones || hasAnyMilestones)) {
      Alert.alert('Choose one', 'A goal can track progress or have milestones, not both.');
      return;
    }
    setHasProgress(value);
  };

  const handleToggleMilestones = (value: boolean) => {
    if (value && hasProgress) {
      Alert.alert('Choose one', 'Turn off progress tracking to use milestones instead.');
      return;
    }
    setHasMilestones(value);
    if (!value) {
      setSubtasks([]);
    }
  };

  const moveSubtask = (index: number, direction: -1 | 1) => {
    setSubtasks((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const resetForm = () => {
    setTitle('');
    setPriority('Medium');
    setSelectedPursuitId(null);
    setShowAdvanced(false);
    setHasProgress(false);
    setTargetValue('');
    setUnit('');
    setHasMilestones(false);
    setIsSequential(true);
    setSubtasks([]);
    setDeletedSubtaskIds([]);
    setSubtaskInput('');
    setIsRecurringGoal(true);
    setOccurrenceCount('');
    setMaxGapDays(1);
    setSelectedTagIds([]);
  };

  useEffect(() => {
    loadTags();
    loadMostUsedTags();
    if (editTask) {
      setTitle(editTask.title ?? '');
      setPriority(editTask.priority ?? 'Medium');
      setSelectedPursuitId(editTask.pursuitId ?? null);

      const hasProg = editTask.totalProgress != null && editTask.totalProgress > 0 && editTask.type === 'Progression';
      setHasProgress(hasProg);
      setTargetValue(hasProg ? String(editTask.totalProgress) : '');
      setUnit(editTask.progressUnit ?? '');

      const isHybrid = editTask.type === 'Hybrid';
      setHasMilestones(isHybrid);
      setIsSequential(Boolean(editTask.isSequential));

      const hasOcc = editTask.occurrenceTarget != null && editTask.occurrenceTarget > 0;
      setIsRecurringGoal(hasOcc);
      setOccurrenceCount(hasOcc ? String(editTask.occurrenceTarget) : '');
      setMaxGapDays(editTask.maxGapDays ?? 1);

      setShowAdvanced(true);

      if (isHybrid) {
        getSubtasksByParent(editTask.id).then((items) => {
          setSubtasks(
            (items ?? []).map((s) => ({
              id: String(s.id),
              title: s.title,
              isCompleted: Boolean(s.isCompleted),
              isNew: false,
            }))
          );
        });
      }
      setDeletedSubtaskIds([]);
    } else {
      resetForm();
    }
  }, [editTask, monthStartDate]);

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, title: subtaskInput.trim(), isCompleted: false, isNew: true },
    ]);
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (id: string) => {
    if (!id.startsWith('temp-')) {
      const numId = Number(id);
      if (!isNaN(numId)) setDeletedSubtaskIds((prev) => [...prev, numId]);
    }
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    if (hasProgress && (!targetValue || Number(targetValue) <= 0)) {
      Alert.alert('Target required', 'Please enter a valid target for this monthly goal.');
      return;
    }
    if (isRecurringGoal && (!occurrenceCount || Number(occurrenceCount) <= 0)) {
      Alert.alert('Count required', 'Enter how many times this month.');
      return;
    }

    try {
      const inferredType = hasMilestones ? 'Hybrid' : hasProgress ? 'Progression' : 'Simple';
      const shouldSaveRecurrence = isRecurringGoal;

      if (editTask) {
        await updateTask(editTask.id, {
          title: title.trim(),
          type: inferredType,
          priority,
          totalProgress: hasProgress ? Number(targetValue) : null,
          progressUnit: hasProgress ? unit.trim() || null : null,
          occurrenceTarget: shouldSaveRecurrence ? Number(occurrenceCount) : null,
          maxGapDays: shouldSaveRecurrence ? maxGapDays : null,
          pursuitId: selectedPursuitId,
          isSequential: hasMilestones ? isSequential : false,
          subtasksTotal: hasMilestones ? subtasks.length : 0,
        });

        for (const delId of deletedSubtaskIds) {
          await deleteTask(delId);
        }

        for (let i = 0; i < subtasks.length; i++) {
          const s = subtasks[i];
          if (s.isNew) {
            await insertSubtask(editTask.id, {
              title: s.title,
              scheduledDate: monthStartDate,
              priority,
              subtaskOrder: i,
            });
          } else {
            await updateTask(Number(s.id), {
              title: s.title,
              subtaskOrder: i,
            } as any);
          }
        }
      } else {
        const parentGoal = await insertTask({
          title: title.trim(),
          type: inferredType,
          priority,
          scheduledDate: monthStartDate,
          deadline: monthEndDate,
          scope: 'monthly',
          totalProgress: hasProgress ? Number(targetValue) : null,
          progressUnit: hasProgress ? unit.trim() || null : null,
          occurrenceTarget: shouldSaveRecurrence ? Number(occurrenceCount) : null,
          maxGapDays: shouldSaveRecurrence ? maxGapDays : null,
          rolloverEnabled: false,
          subtasksTotal: hasMilestones ? subtasks.length : 0,
          pursuitId: selectedPursuitId,
          isSequential: hasMilestones ? isSequential : false,
        });

        if (parentGoal) {
          if (hasMilestones && subtasks.length > 0) {
            for (let i = 0; i < subtasks.length; i++) {
              await insertSubtask(parentGoal.id, {
                title: subtasks[i].title,
                scheduledDate: monthStartDate,
                priority,
                subtaskOrder: i,
              });
            }
          }
          for (const tagId of selectedTagIds) {
            await assignTag(parentGoal.id, tagId);
          }
        }
      }

      resetForm();
      onTaskCreated();
      if (onClose) onClose();
      sheetRef.current?.close();
    } catch (error) {
      console.error('Failed to save monthly task:', error);
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface }}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      onClose={() => {
        resetForm();
        if (onClose) onClose();
      }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.titleText}>{editTask ? 'Edit Monthly Goal' : 'Plan Goal for Month'}</Text>
        <Text style={styles.subTitleText}>Period: {formattedMonthLabel}</Text>

        <BottomSheetTextInput
          style={styles.input}
          placeholder="What macro goal do you want to accomplish?"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.row}>
          <Text style={styles.label}>Priority:</Text>
          <View style={styles.selectorGroup}>
            {PRIORITY_OPTIONS.map((p) => (
              <Pressable
                key={p}
                style={[styles.selectorItem, priority === p && styles.selectedItem]}
                onPress={() => setPriority(p)}
              >
                <Text style={priority === p ? styles.selectedText : styles.unselectedText}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.dynamicContainer, { marginTop: 6 }]}>
          <Text style={styles.subSectionTitle}>Pursuit</Text>
          <PursuitPicker selectedPursuitId={selectedPursuitId} onSelect={setSelectedPursuitId} />
        </View>

        <TouchableOpacity style={styles.advancedToggleRow} onPress={() => setShowAdvanced((s) => !s)}>
          <Text style={styles.advancedToggleText}>Advanced Options</Text>
          <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {showAdvanced && (
          <>
            <View style={styles.dynamicContainer}>
              <View style={styles.row}>
                <Text style={styles.label}>Track progress (units):</Text>
                <Switch
                  value={hasProgress}
                  onValueChange={handleToggleProgress}
                  disabled={hasMilestones}
                  trackColor={{ false: colors.borderSubtle, true: colors.accent }}
                />
              </View>
              {hasProgress && (
                <>
                  <View style={styles.row}>
                    <Text style={styles.label}>Target this month:</Text>
                    <BottomSheetTextInput
                      style={styles.inputNested}
                      value={targetValue}
                      onChangeText={setTargetValue}
                      placeholder="e.g. 300"
                      keyboardType="numeric"
                      placeholderTextColor={colors.textPlaceholder}
                    />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Unit:</Text>
                    <BottomSheetTextInput
                      style={styles.inputNested}
                      value={unit}
                      onChangeText={setUnit}
                      placeholder="pages, chapters, km"
                      placeholderTextColor={colors.textPlaceholder}
                    />
                  </View>
                </>
              )}
            </View>

            <View style={styles.dynamicContainer}>
              <View style={styles.row}>
                <Text style={styles.label}>Repeat as multiple occurrences:</Text>
                <Switch
                  value={isRecurringGoal}
                  onValueChange={setIsRecurringGoal}
                  trackColor={{ false: colors.borderSubtle, true: colors.accent }}
                />
              </View>
              {isRecurringGoal && (
                <>
                  <View style={styles.row}>
                    <Text style={styles.label}>Times this month:</Text>
                    <BottomSheetTextInput
                      style={styles.inputNested}
                      value={occurrenceCount}
                      onChangeText={setOccurrenceCount}
                      placeholder="e.g. 8"
                      keyboardType="numeric"
                      placeholderTextColor={colors.textPlaceholder}
                    />
                  </View>

                  <Text style={[styles.label, { marginTop: 8 }]}>
                    Max gap: {maxGapDays} day{maxGapDays > 1 ? 's' : ''} {maxPossibleGap === 1 ? '(Tight schedule)' : ''}
                  </Text>
                  <Slider
                    style={{ width: '100%', height: 36 }}
                    minimumValue={1}
                    maximumValue={maxPossibleGap}
                    step={1}
                    value={maxGapDays}
                    onValueChange={setMaxGapDays}
                    minimumTrackTintColor={colors.accent}
                    maximumTrackTintColor={colors.borderSubtle}
                    thumbTintColor={colors.accent}
                  />
                  <Text style={styles.hintText}>
                    {hasProgress
                      ? `Splits ${targetValue || 'the target'} ${unit} across ${occurrenceCount || '—'} runs, spaced up to ${maxPossibleGap} day${maxPossibleGap > 1 ? 's' : ''} apart, pulled closer if you fall behind.`
                      : `Spaced up to ${maxPossibleGap} day${maxPossibleGap > 1 ? 's' : ''} apart given ${occurrenceCount || '—'} times, pulled closer if you miss one.`}
                  </Text>
                </>
              )}
            </View>

            <View style={styles.dynamicContainer}>
              <View style={styles.row}>
                <Text style={styles.label}>Milestones (checklist):</Text>
                <Switch
                  value={hasMilestones}
                  onValueChange={handleToggleMilestones}
                  disabled={hasProgress}
                  trackColor={{ false: colors.borderSubtle, true: colors.accent }}
                />
              </View>

              {hasMilestones && (
                <View style={[styles.row, { alignItems: 'flex-start', marginTop: 4 }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.label}>Sequential order</Text>
                    <Text style={styles.hintText}>
                      Only the current milestone shows up on Today; the next unlocks once it&apos;s done.
                    </Text>
                  </View>
                  <Switch
                    value={isSequential}
                    onValueChange={setIsSequential}
                    trackColor={{ false: colors.borderSubtle, true: colors.accent }}
                  />
                </View>
              )}

              {hasMilestones && (
                <>
                  <View style={styles.addSubtaskRow}>
                    <BottomSheetTextInput
                      style={styles.subtaskInput}
                      value={subtaskInput}
                      onChangeText={setSubtaskInput}
                      placeholder="Enter milestone title..."
                      placeholderTextColor={colors.textPlaceholder}
                      onSubmitEditing={handleAddSubtask}
                    />
                    <TouchableOpacity style={styles.addBtn} onPress={handleAddSubtask}>
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {subtasks.map((s, idx) => (
                    <View key={s.id} style={styles.subtaskItem}>
                      <Text
                        style={[
                          styles.subtaskTitle,
                          s.isCompleted && { textDecorationLine: 'line-through', color: colors.textMuted },
                        ]}
                      >
                        {idx + 1}. {s.title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {isSequential && (
                          <>
                            <TouchableOpacity onPress={() => moveSubtask(idx, -1)} disabled={idx === 0}>
                              <Ionicons
                                name="chevron-up"
                                size={16}
                                color={idx === 0 ? colors.textMuted : colors.accent}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => moveSubtask(idx, 1)}
                              disabled={idx === subtasks.length - 1}
                            >
                              <Ionicons
                                name="chevron-down"
                                size={16}
                                color={idx === subtasks.length - 1 ? colors.textMuted : colors.accent}
                              />
                            </TouchableOpacity>
                          </>
                        )}
                        <TouchableOpacity onPress={() => handleRemoveSubtask(s.id)}>
                          <Text style={styles.removeText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>

            <View style={styles.dynamicContainer}>
              <Text style={styles.subSectionTitle}>Tags</Text>
              <TagPicker
                allTags={allTags}
                mostUsedTags={mostUsedTags}
                selectedTagIds={selectedTagIds}
                onToggleTag={(tagId) =>
                  setSelectedTagIds((prev) =>
                    prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
                  )
                }
                onCreateTag={(name) => addTag({ name })}
                onDeleteTag={(tagId) => {
                  setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
                  removeTag(tagId);
                }}
              />
            </View>
          </>
        )}

        <View style={{ marginTop: 24, width: '100%', paddingBottom: 40 }}>
          <Pressable
            disabled={!title.trim()}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              !title.trim() && styles.submitDisabled,
              pressed && title.trim() ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={styles.submitButtonText}>{editTask ? 'Save Changes' : 'Schedule Monthly Goal'}</Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    contentContainer: { padding: 24 },
    titleText: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: colors.textPrimary },
    subTitleText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 16 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      backgroundColor: colors.surfaceSubtle,
      color: colors.textPrimary,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
    label: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
    selectorGroup: { flexDirection: 'row' },
    selectorItem: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      backgroundColor: colors.surfaceSubtle,
      marginLeft: 6,
    },
    selectedItem: { borderColor: colors.selectedBorder, backgroundColor: colors.selectedBg },
    unselectedText: { color: colors.textSecondary, fontSize: 12 },
    selectedText: { color: colors.selectedText, fontWeight: '600', fontSize: 12 },
    advancedToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    advancedToggleText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.3 },
    dynamicContainer: {
      marginTop: 10,
      padding: 12,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputNested: {
      flex: 1.5,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      fontSize: 15,
      backgroundColor: colors.surfaceSubtle,
      marginLeft: 12,
      color: colors.textPrimary,
    },
    hintText: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
    subSectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
    addSubtaskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 6 },
    subtaskInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      fontSize: 14,
      backgroundColor: colors.surfaceSubtle,
      marginRight: 8,
      color: colors.textPrimary,
    },
    addBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
    addBtnText: { color: colors.textOnAccent, fontWeight: '600', fontSize: 13 },
    subtaskItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    subtaskTitle: { color: colors.textPrimary, fontSize: 13, flex: 1, marginRight: 8 },
    removeText: { color: colors.danger, fontWeight: 'bold' },
    submitButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    submitDisabled: { backgroundColor: colors.surfaceElevated },
    submitButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '700' },
  });