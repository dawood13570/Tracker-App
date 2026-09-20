// src/components/new-task.tsx
import { useTagStore } from '@/store/tagStore';
import { useStore } from '@/store/useStore';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Platform, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { assignTag, deleteTask, getSubtasksByParent, getTagsForTask, insertSubtask, insertTask, removeTag as removeTagFromTask, updateTask } from '../db/queries';
import { Task, useTaskStore } from '../store/taskStore';
import { colors } from '../theme/colors';
import { getLocalDateString } from '../utils/date';
import { AddType, AddTypeSwitcher } from './AddTypeSwitcher';
import { PursuitPicker } from './PursuitPicker';
import { TagPicker } from './TagPicker';

interface SubTaskDraft {
  id: string;
  title: string;
  isCompleted?: boolean;
  isNew?: boolean;
  hasProgress?: boolean;
  targetValue?: string;
  unit?: string;
}

interface NewTaskModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  onTaskCreated: () => void;
  taskToEdit?: Task | null;
  onClose?: () => void;
  onSwitchType?: (type: AddType) => void;
}

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'every_n_days', label: 'N Days' },
  { value: 'weekly', label: 'Weekly' },
] as const;

const DAYS_OF_WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

export default function NewTaskModal({ sheetRef, onTaskCreated, taskToEdit, onClose, onSwitchType }: NewTaskModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [selectedPursuitId, setSelectedPursuitId] = useState<number | null>(null);

  const [hasProgress, setHasProgress] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');

  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'every_n_days' | 'weekly'>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState('');
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);

  const [subtasks, setSubtasks] = useState<SubTaskDraft[]>([]);
  const [deletedSubtaskIds, setDeletedSubtaskIds] = useState<number[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [expandedSubtaskIds, setExpandedSubtaskIds] = useState<Set<string>>(new Set());

  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const { defaultRolloverEnabled, defaultSurplusMode } = useStore();
  const [allowRollover, setAllowRollover] = useState(defaultRolloverEnabled);

  const { selectedDate } = useTaskStore();
  const snapPoints = useMemo(() => ['85%', '55%'], []);

  const hasAnySubtasks = subtasks.length > 0;

  const handleToggleProgress = (value: boolean) => {
    if (value && hasAnySubtasks) {
      Alert.alert('Choose one', 'A task can track progress or have subtasks, not both. Remove subtasks first, or give a subtask its own progress instead.');
      return;
    }
    setHasProgress(value);
  };

  const handleAddSubtask = () => {
    if (subtaskInput.trim() === '') return;
    if (hasProgress) {
      Alert.alert('Choose one', 'Turn off progress tracking to add subtasks, or track progress on the subtask itself.');
      return;
    }
    setSubtasks((prev) => [...prev, { id: `temp-${Date.now()}`, title: subtaskInput.trim(), isCompleted: false, isNew: true }]);
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (id: string) => {
    if (!id.startsWith('temp-')) {
      const numId = Number(id);
      if (!isNaN(numId)) setDeletedSubtaskIds((prev) => [...prev, numId]);
    }
    setSubtasks((prev) => prev.filter((sub) => sub.id !== id));
  };

  const updateSubtaskDraft = (id: string, patch: Partial<SubTaskDraft>) => {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const toggleSubtaskExpanded = (id: string) => {
    setExpandedSubtaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleRecurrenceDay = (day: string) => {
    setRecurrenceDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleDeadlineChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDeadlinePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selected) setDeadline(selected);
  };

  const resetForm = () => {
    setTitle('');
    setPriority('Low');
    setShowAdvanced(false);
    setAllowRollover(defaultRolloverEnabled);
    setSelectedPursuitId(null);
    setHasProgress(false);
    setTargetValue('');
    setUnit('');
    setDeadline(null);
    setShowDeadlinePicker(false);
    setRecurrenceType('none');
    setRecurrenceInterval('');
    setRecurrenceDaysOfWeek([]);
    setSubtasks([]);
    setDeletedSubtaskIds([]);
    setSubtaskInput('');
    setExpandedSubtaskIds(new Set());
    setSelectedTagIds([]);
  };

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title ?? '');
      setPriority(taskToEdit.priority ?? 'Low');
      setAllowRollover(Boolean(taskToEdit.rolloverEnabled));
      setSelectedPursuitId((taskToEdit as any).pursuitId ?? null);

      const hasProg = taskToEdit.totalProgress != null && taskToEdit.totalProgress > 0;
      setHasProgress(hasProg);
      setTargetValue(hasProg ? String(taskToEdit.totalProgress) : '');
      setUnit(taskToEdit.progressUnit ?? '');
      setDeadline(taskToEdit.deadline ? new Date(`${taskToEdit.deadline}T00:00:00`) : null);

      setRecurrenceType((taskToEdit.recurrenceType as typeof recurrenceType) ?? 'none');
      setRecurrenceInterval(taskToEdit.recurrenceInterval ? String(taskToEdit.recurrenceInterval) : '');
      try {
        setRecurrenceDaysOfWeek(taskToEdit.recurrenceDaysOfWeek ? JSON.parse(taskToEdit.recurrenceDaysOfWeek) : []);
      } catch {
        setRecurrenceDaysOfWeek([]);
      }

      const hasAdvancedContent = Boolean(
        hasProg || taskToEdit.deadline || taskToEdit.recurrenceType !== 'none' ||
        (taskToEdit as any).pursuitId || !taskToEdit.rolloverEnabled
      );
      setShowAdvanced(hasAdvancedContent);

      getSubtasksByParent(taskToEdit.id).then((items) => {
        setSubtasks(items.map((sub) => ({
          id: sub.id.toString(),
          title: sub.title,
          isCompleted: sub.isCompleted,
          isNew: false,
          hasProgress: sub.totalProgress != null,
          targetValue: sub.totalProgress ? String(sub.totalProgress) : '',
          unit: sub.progressUnit ?? '',
        })));
        if (items.length > 0) setShowAdvanced(true);
      });
      setDeletedSubtaskIds([]);
    } else {
      resetForm();
    }
  }, [taskToEdit]);

  useEffect(() => {
    loadTags();
    loadMostUsedTags();
  }, []);

  useEffect(() => {
    if (taskToEdit) {
      getTagsForTask(taskToEdit.id).then((rows) => setSelectedTagIds(rows.map((r) => r.id)));
    } else {
      setSelectedTagIds([]);
    }
  }, [taskToEdit]);

  const handleToggleTag = async (tagId: number) => {
    const isSelected = selectedTagIds.includes(tagId);
    if (taskToEdit) {
      if (isSelected) await removeTagFromTask(taskToEdit.id, tagId);
      else await assignTag(taskToEdit.id, tagId);
    }
    setSelectedTagIds((prev) => (isSelected ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleDeleteTag = async (tagId: number) => {
    if (taskToEdit && selectedTagIds.includes(tagId)) await removeTagFromTask(taskToEdit.id, tagId);
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    await removeTag(tagId);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    if (hasProgress && (!targetValue || Number(targetValue) <= 0)) {
      Alert.alert('Target required', 'Please enter a valid target for progress tracking, or turn it off.');
      return;
    }
    for (const s of subtasks) {
      if (s.hasProgress && (!s.targetValue || Number(s.targetValue) <= 0)) {
        Alert.alert('Subtask target required', `Enter a valid target for "${s.title}", or turn off its progress tracking.`);
        return;
      }
    }
    if (recurrenceType === 'every_n_days' && (!recurrenceInterval || Number(recurrenceInterval) <= 0)) {
      Alert.alert('Interval required', 'Please enter how many days between repeats.');
      return;
    }
    if (recurrenceType === 'weekly' && recurrenceDaysOfWeek.length === 0) {
      Alert.alert('Days required', 'Please select at least one day of the week.');
      return;
    }

    try {
      const inferredType = hasAnySubtasks ? 'Hybrid' : hasProgress ? 'Progression' : 'Simple';

      const sharedFields = {
        title: title.trim(),
        type: inferredType as 'Simple' | 'Hybrid' | 'Progression',
        priority: priority as 'Low' | 'Medium' | 'High',
        rolloverEnabled: allowRollover,
        pursuitId: selectedPursuitId,
        recurrenceType,
        recurrenceInterval: recurrenceType === 'every_n_days' ? Number(recurrenceInterval) || null : null,
        recurrenceDaysOfWeek: recurrenceType === 'weekly' ? JSON.stringify(recurrenceDaysOfWeek) : null,
        totalProgress: hasProgress ? Number(targetValue) : null,
        progressUnit: hasProgress ? unit.trim() || null : null,
        deadline: deadline ? getLocalDateString(deadline) : null,
        surplusMode: hasProgress ? defaultSurplusMode : null,
      };

      if (taskToEdit) {
        await updateTask(taskToEdit.id, sharedFields);
        for (const delId of deletedSubtaskIds) await deleteTask(delId);
        for (const sub of subtasks) {
          if (sub.isNew) {
            await insertSubtask(taskToEdit.id, {
              title: sub.title,
              scheduledDate: taskToEdit.scheduledDate,
              priority: priority as 'Low' | 'Medium' | 'High',
              type: sub.hasProgress ? 'Progression' : 'Simple',
              totalProgress: sub.hasProgress ? Number(sub.targetValue) : null,
              progressUnit: sub.hasProgress ? (sub.unit?.trim() || null) : null,
            });
          }
        }
      } else {
        const createdParent = await insertTask({ ...sharedFields, scheduledDate: selectedDate, scope: 'daily' });

        if (createdParent && subtasks.length > 0) {
          for (const draft of subtasks) {
            await insertSubtask(createdParent.id, {
              title: draft.title,
              scheduledDate: selectedDate,
              priority: priority as 'Low' | 'Medium' | 'High',
              type: draft.hasProgress ? 'Progression' : 'Simple',
              totalProgress: draft.hasProgress ? Number(draft.targetValue) : null,
              progressUnit: draft.hasProgress ? (draft.unit?.trim() || null) : null,
            });
          }
        }
        if (createdParent && selectedTagIds.length > 0) {
          for (const tagId of selectedTagIds) await assignTag(createdParent.id, tagId);
        }
      }

      resetForm();
      onTaskCreated();
      if (onClose) onClose();
      sheetRef.current?.close();
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      onClose={() => { resetForm(); if (onClose) onClose(); }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        {!taskToEdit && onSwitchType && (
          <View style={styles.switcherWrapper}>
            <AddTypeSwitcher active="Task" onSelect={onSwitchType} />
          </View>
        )}
        <Text style={styles.titleText}>{taskToEdit ? 'Edit Task' : 'New Task'}</Text>

        <BottomSheetTextInput
          style={styles.input}
          placeholder="What do you need to do?"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.selectorGroup}>
              {PRIORITY_OPTIONS.map((p) => {
                const isSelected = priority === p;
                const priorityStyles: Record<string, { item: any; text: any }> = {
                  Low: { item: styles.selectedLow, text: styles.textLow },
                  Medium: { item: styles.selectedMedium, text: styles.textMedium },
                  High: { item: styles.selectedHigh, text: styles.textHigh },
                };
                return (
                  <Pressable key={p} style={[styles.selectorItem, isSelected && priorityStyles[p].item]} onPress={() => setPriority(p)}>
                    <Text style={[isSelected ? priorityStyles[p].text : styles.unselectedText]}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.advancedToggleRow} onPress={() => setShowAdvanced((s) => !s)}>
          <Text style={styles.advancedToggleText}>Advanced Options</Text>
          <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {showAdvanced && (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.subSectionTitle}>Pursuit</Text>
              <PursuitPicker selectedPursuitId={selectedPursuitId} onSelect={setSelectedPursuitId} />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.subSectionTitle}>Tags</Text>
              <TagPicker
                allTags={allTags}
                mostUsedTags={mostUsedTags}
                selectedTagIds={selectedTagIds}
                onToggleTag={handleToggleTag}
                onCreateTag={(name) => addTag({ name })}
                onDeleteTag={handleDeleteTag}
              />
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.label}>Rollover Task</Text>
                  <Text style={styles.subLabel}>Move incomplete work to the next day</Text>
                </View>
                <Switch value={allowRollover} onValueChange={setAllowRollover} trackColor={{ false: colors.border, true: colors.accent }} thumbColor={colors.textOnAccent} />
              </View>

              <View style={styles.divider} />

              <View style={styles.rowColumn}>
                <View style={styles.rowHeader}><Text style={styles.label}>Repeats</Text></View>
                <View style={[styles.selectorGroup, styles.recurrenceSelectorGroup]}>
                  {RECURRENCE_OPTIONS.map(({ value, label }) => {
                    const isSelected = recurrenceType === value;
                    return (
                      <Pressable key={value} style={[styles.selectorItem, isSelected && styles.selectedItem]} onPress={() => setRecurrenceType(value)}>
                        <Text style={isSelected ? styles.selectedText : styles.unselectedText}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {recurrenceType === 'every_n_days' && (
                <View style={[styles.row, { marginTop: 12 }]}>
                  <Text style={styles.subLabel}>Repeat every</Text>
                  <View style={styles.inlineInputWrapper}>
                    <BottomSheetTextInput
                      style={styles.inlineInput}
                      value={recurrenceInterval}
                      onChangeText={setRecurrenceInterval}
                      placeholder="3"
                      keyboardType="numeric"
                      placeholderTextColor={colors.textPlaceholder}
                    />
                    <Text style={styles.unitLabel}>days</Text>
                  </View>
                </View>
              )}

              {recurrenceType === 'weekly' && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.subLabel, { marginBottom: 8 }]}>Repeat on days</Text>
                  <View style={styles.dayOfWeekRow}>
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = recurrenceDaysOfWeek.includes(day);
                      return (
                        <Pressable key={day} style={[styles.dayPill, isSelected && styles.selectedItem]} onPress={() => toggleRecurrenceDay(day)}>
                          <Text style={isSelected ? styles.selectedText : styles.unselectedText}>{day.toUpperCase()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.label}>Track Progress</Text>
                  <Text style={styles.subLabel}>
                    {hasAnySubtasks ? 'Unavailable — this task has subtasks' : 'Add numeric target & units'}
                  </Text>
                </View>
                <Switch
                  value={hasProgress}
                  onValueChange={handleToggleProgress}
                  disabled={hasAnySubtasks}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textOnAccent}
                />
              </View>

              {hasProgress && (
                <>
                  <View style={styles.divider} />
                  <View style={[styles.row, { marginTop: 8 }]}>
                    <Text style={styles.label}>Target Value</Text>
                    <BottomSheetTextInput style={styles.inputs} value={targetValue} onChangeText={setTargetValue} placeholder="e.g., 30" keyboardType="numeric" placeholderTextColor={colors.textPlaceholder} />
                  </View>
                  <View style={[styles.row, { marginTop: 12 }]}>
                    <Text style={styles.label}>Unit</Text>
                    <BottomSheetTextInput style={styles.inputs} value={unit} onChangeText={setUnit} placeholder="e.g., pages, km" placeholderTextColor={colors.textPlaceholder} />
                  </View>
                </>
              )}

              <View style={styles.divider} />

              <View style={[styles.row, { marginTop: 4 }]}>
                <Text style={styles.label}>Deadline (optional)</Text>
                <Pressable onPress={() => setShowDeadlinePicker(true)} style={styles.deadlinePressable}>
                  <Text style={deadline ? styles.deadlineText : styles.deadlinePlaceholder}>
                    {deadline ? getLocalDateString(deadline) : 'None set'}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.hintText}>
                Without a deadline, this task tracks progress but skips pace/behind-ahead status — there's nothing to compare against.
              </Text>

              {showDeadlinePicker && (
                <DateTimePicker
                  value={deadline ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={handleDeadlineChange}
                />
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.subSectionTitle}>
                Subtasks {hasProgress ? '(unavailable — this task tracks progress)' : ''}
              </Text>

              <View style={styles.addSubtaskRow}>
                <BottomSheetTextInput
                  style={[styles.subtaskTextInput, hasProgress && { opacity: 0.5 }]}
                  value={subtaskInput}
                  onChangeText={setSubtaskInput}
                  placeholder="Add a subtask..."
                  placeholderTextColor={colors.textPlaceholder}
                  onSubmitEditing={handleAddSubtask}
                  editable={!hasProgress}
                />
                <TouchableOpacity style={[styles.addSubtaskButton, hasProgress && { opacity: 0.5 }]} onPress={handleAddSubtask} disabled={hasProgress}>
                  <Text style={styles.addSubtaskButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              {subtasks.length > 0 && (
                <View style={styles.subtaskListContainer}>
                  {subtasks.map((item, index) => {
                    const isExpanded = expandedSubtaskIds.has(item.id);
                    return (
                      <View key={item.id} style={styles.subtaskItemRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.subtaskIndex}>{index + 1}</Text>
                          <Text
                            style={[styles.subtaskTitle, item.isCompleted && { textDecorationLine: 'line-through', color: colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <TouchableOpacity onPress={() => toggleSubtaskExpanded(item.id)} style={{ paddingHorizontal: 8 }}>
                            <Ionicons name={isExpanded ? 'chevron-up' : 'options-outline'} size={14} color={colors.textMuted} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleRemoveSubtask(item.id)} style={styles.removeSubtaskButton}>
                            <Text style={styles.removeSubtaskButtonText}>✕</Text>
                          </TouchableOpacity>
                        </View>

                        {isExpanded && (
                          <View style={styles.subtaskProgressPanel}>
                            <View style={styles.row}>
                              <Text style={styles.subLabel}>Track progress on this subtask:</Text>
                              <Switch
                                value={Boolean(item.hasProgress)}
                                onValueChange={(v) => updateSubtaskDraft(item.id, { hasProgress: v })}
                                trackColor={{ false: colors.border, true: colors.accent }}
                              />
                            </View>
                            {item.hasProgress && (
                              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                                <BottomSheetTextInput
                                  style={[styles.inlineInput, { flex: 1 }]}
                                  value={item.targetValue}
                                  onChangeText={(v) => updateSubtaskDraft(item.id, { targetValue: v })}
                                  placeholder="Target"
                                  keyboardType="numeric"
                                  placeholderTextColor={colors.textPlaceholder}
                                />
                                <BottomSheetTextInput
                                  style={[styles.inlineInput, { flex: 1 }]}
                                  value={item.unit}
                                  onChangeText={(v) => updateSubtaskDraft(item.id, { unit: v })}
                                  placeholder="Unit"
                                  placeholderTextColor={colors.textPlaceholder}
                                />
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.submitContainer}>
          <Pressable
            disabled={!title.trim()}
            onPress={handleSubmit}
            style={({ pressed }) => [styles.submitButton, !title.trim() && styles.submitButtonDisabled, pressed && title.trim() ? { opacity: 0.85 } : null]}
          >
            <Text style={[styles.submitButtonText, !title.trim() && { color: colors.textMuted }]}>
              {taskToEdit ? 'Update Task' : 'Create Task'}
            </Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  switcherWrapper: { marginBottom: 16 },
  titleText: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16, color: colors.textPrimary, letterSpacing: 0.3 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, backgroundColor: colors.surfaceSubtle, color: colors.textPrimary, marginBottom: 16 },
  sectionCard: { backgroundColor: colors.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, padding: 16, marginBottom: 16 },
  advancedToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: 8 },
  advancedToggleText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowColumn: { flexDirection: 'column', alignItems: 'stretch' },
  rowHeader: { marginBottom: 8 },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 12 },
  label: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  subLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  hintText: { fontSize: 11, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' },
  selectorGroup: { flexDirection: 'row', gap: 6 },
  recurrenceSelectorGroup: { flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 4 },
  selectorItem: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surfaceSubtle },
  selectedItem: { borderColor: colors.selectedBorder, backgroundColor: colors.selectedBg },
  unselectedText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  selectedText: { color: colors.selectedText, fontWeight: '600', fontSize: 13 },
  selectedLow: { backgroundColor: colors.priorityLowBg, borderColor: colors.priorityLowBorder, borderWidth: 1 },
  textLow: { color: colors.priorityLowText, fontWeight: '600', fontSize: 13 },
  selectedMedium: { backgroundColor: colors.priorityMediumBg, borderColor: colors.priorityMediumBorder, borderWidth: 1 },
  textMedium: { color: colors.priorityMediumText, fontWeight: '600', fontSize: 13 },
  selectedHigh: { backgroundColor: colors.priorityHighBg, borderColor: colors.priorityHighBorder, borderWidth: 1 },
  textHigh: { color: colors.priorityHighText, fontWeight: '600', fontSize: 13 },
  inputs: { flex: 1, maxWidth: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, backgroundColor: colors.surfaceSubtle, color: colors.textPrimary, textAlign: 'right' },
  inlineInputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineInput: { width: 60, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, textAlign: 'center', fontSize: 14, backgroundColor: colors.surfaceSubtle, color: colors.textPrimary },
  unitLabel: { fontSize: 14, color: colors.textSecondary },
  dayOfWeekRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayPill: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surfaceSubtle },
  subSectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  subtaskTextInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: colors.surfaceSubtle, color: colors.textPrimary },
  addSubtaskButton: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  addSubtaskButtonText: { color: colors.textOnAccent, fontWeight: '600', fontSize: 14 },
  subtaskListContainer: { backgroundColor: colors.surfaceSubtle, borderRadius: 8, borderWidth: 1, borderColor: colors.borderSubtle, overflow: 'hidden' },
  subtaskItemRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  subtaskIndex: { fontSize: 12, fontWeight: '600', color: colors.textMuted, width: 20 },
  subtaskTitle: { flex: 1, fontSize: 14, color: colors.textPrimary },
  subtaskProgressPanel: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  removeSubtaskButton: { padding: 4 },
  removeSubtaskButtonText: { fontSize: 14, color: colors.danger, fontWeight: '600' },
  submitContainer: { marginTop: 8, width: '100%' },
  submitButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  submitButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '700' },
  deadlinePressable: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surfaceSubtle, minWidth: 160, alignItems: 'flex-end' },
  deadlineText: { fontSize: 15, color: colors.textPrimary },
  deadlinePlaceholder: { fontSize: 15, color: colors.textPlaceholder },
});