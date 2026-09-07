// src/components/new-task.tsx
import { useTagStore } from '@/store/tagStore';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Platform, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { assignTag, deleteTask, getSubtasksByParent, getTagsForTask, insertSubtask, removeTag as removeTagFromTask } from '../db/queries';
import { Task, useTaskStore } from '../store/taskStore';
import { colors } from '../theme/colors';
import { getLocalDateString } from '../utils/date';
import { AddType, AddTypeSwitcher } from './AddTypeSwitcher';
import { TagPicker } from './TagPicker';

interface SubTaskDraft {
  id: string;
  title: string;
  isCompleted: boolean;
  isNew?: boolean;
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
const TASK_TYPES = ['Simple', 'Progression', 'Hybrid'] as const;
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

export default function NewTaskModal({ sheetRef, onTaskCreated, taskToEdit, onClose, onSwitchType }: NewTaskModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'Simple' | 'Progression' | 'Hybrid'>('Simple');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [allowRollover, setAllowRollover] = useState(false);

  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'every_n_days' | 'weekly'>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState('');
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);

  const { addTask, updateTask, selectedDate } = useTaskStore();
  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [subtasks, setSubtasks] = useState<SubTaskDraft[]>([]);
  const [deletedSubtaskIds, setDeletedSubtaskIds] = useState<number[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const snapPoints = useMemo(() => ['75%', '50%'], []);

  const handleAddSubtask = () => {
    if (subtaskInput.trim() === '') return;

    const newSubtask: SubTaskDraft = {
      id: `temp-${Date.now()}`,
      title: subtaskInput.trim(),
      isCompleted: false,
      isNew: true,
    };

    setSubtasks((prev) => [...prev, newSubtask]);
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (id: string) => {
    if (!id.startsWith('temp-')) {
      const numId = Number(id);
      if (!isNaN(numId)) {
        setDeletedSubtaskIds((prev) => [...prev, numId]);
      }
    }
    setSubtasks((prev) => prev.filter((sub) => sub.id !== id));
  };

  const toggleRecurrenceDay = (day: string) => {
    setRecurrenceDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleDeadlineChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDeadlinePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selected) {
      setDeadline(selected);
    }
  };

  const resetForm = () => {
    setTitle('');
    setType('Simple');
    setPriority('Low');
    setTargetValue('');
    setUnit('');
    setDeadline(null);
    setShowDeadlinePicker(false);
    setAllowRollover(false);
    setRecurrenceType('none');
    setRecurrenceInterval('');
    setRecurrenceDaysOfWeek([]);
    setSubtasks([]);
    setDeletedSubtaskIds([]);
    setSubtaskInput('');
    setSelectedTagIds([]);
  };

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title ?? '');
      setType(taskToEdit.type ?? 'Simple');
      setPriority(taskToEdit.priority ?? 'Low');
      setAllowRollover(Boolean(taskToEdit.rolloverEnabled));

      setTargetValue(taskToEdit.totalProgress ? String(taskToEdit.totalProgress) : '');
      setUnit(taskToEdit.progressUnit ?? '');
      setDeadline(taskToEdit.deadline ? new Date(`${taskToEdit.deadline}T00:00:00`) : null);

      setRecurrenceType((taskToEdit.recurrenceType as typeof recurrenceType) ?? 'none');
      setRecurrenceInterval(
        taskToEdit.recurrenceInterval ? String(taskToEdit.recurrenceInterval) : ''
      );
      try {
        setRecurrenceDaysOfWeek(
          taskToEdit.recurrenceDaysOfWeek ? JSON.parse(taskToEdit.recurrenceDaysOfWeek) : []
        );
      } catch {
        setRecurrenceDaysOfWeek([]);
      }

      if (taskToEdit.type === 'Hybrid') {
        getSubtasksByParent(taskToEdit.id).then((items) => {
          setSubtasks(
            items.map((sub) => ({
              id: sub.id.toString(),
              title: sub.title,
              isCompleted: sub.isCompleted,
              isNew: false,
            }))
          );
        });
      }
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
      if (isSelected) {
        await removeTagFromTask(taskToEdit.id, tagId);
      } else {
        await assignTag(taskToEdit.id, tagId);
      }
    }
    setSelectedTagIds((prev) =>
      isSelected ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleDeleteTag = async (tagId: number) => {
    if (taskToEdit && selectedTagIds.includes(tagId)) {
      await removeTagFromTask(taskToEdit.id, tagId);
    }
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    await removeTag(tagId);
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
          placeholder="What needs to be done?"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.selectorGroup}>
              {TASK_TYPES.map((t) => {
                const isSelected = type === t;
                return (
                  <Pressable
                    key={t}
                    style={[styles.selectorItem, isSelected && styles.selectedItem]}
                    onPress={() => setType(t)}
                  >
                    <Text style={isSelected ? styles.selectedText : styles.unselectedText}>
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

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
                  <Pressable
                    key={p}
                    style={[styles.selectorItem, isSelected && priorityStyles[p].item]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[isSelected ? priorityStyles[p].text : styles.unselectedText]}>
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
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
            <Switch
              value={allowRollover}
              onValueChange={setAllowRollover}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.textOnAccent}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.rowColumn}>
            <View style={styles.rowHeader}>
              <Text style={styles.label}>Repeats</Text>
            </View>
            <View style={[styles.selectorGroup, styles.recurrenceSelectorGroup]}>
              {RECURRENCE_OPTIONS.map(({ value, label }) => {
                const isSelected = recurrenceType === value;
                return (
                  <Pressable
                    key={value}
                    style={[styles.selectorItem, isSelected && styles.selectedItem]}
                    onPress={() => setRecurrenceType(value)}
                  >
                    <Text style={isSelected ? styles.selectedText : styles.unselectedText}>
                      {label}
                    </Text>
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
                    <Pressable
                      key={day}
                      style={[styles.dayPill, isSelected && styles.selectedItem]}
                      onPress={() => toggleRecurrenceDay(day)}
                    >
                      <Text style={isSelected ? styles.selectedText : styles.unselectedText}>
                        {day.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* PROGRESSION TASK INPUTS */}
        {type === 'Progression' && (
          <View style={styles.sectionCard}>
            <Text style={styles.subSectionTitle}>Progression Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Target Value</Text>
              <BottomSheetTextInput
                style={styles.inputs}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder="e.g., 100"
                keyboardType="numeric"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={[styles.row, { marginTop: 12 }]}>
              <Text style={styles.label}>Unit</Text>
              <BottomSheetTextInput
                style={styles.inputs}
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g., kg, miles, reps"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={[styles.row, { marginTop: 12 }]}>
              <Text style={styles.label}>Deadline</Text>
              <Pressable onPress={() => setShowDeadlinePicker(true)} style={styles.deadlinePressable}>
                <Text style={deadline ? styles.deadlineText : styles.deadlinePlaceholder}>
                  {deadline ? getLocalDateString(deadline) : 'Select a date'}
                </Text>
              </Pressable>
            </View>

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
        )}

        {/* HYBRID TASK INPUTS */}
        {type === 'Hybrid' && (
          <View style={styles.sectionCard}>
            <Text style={styles.subSectionTitle}>Subtasks</Text>

            <View style={styles.addSubtaskRow}>
              <BottomSheetTextInput
                style={styles.subtaskTextInput}
                value={subtaskInput}
                onChangeText={setSubtaskInput}
                placeholder="Add a subtask..."
                placeholderTextColor={colors.textPlaceholder}
                onSubmitEditing={handleAddSubtask}
              />
              <TouchableOpacity style={styles.addSubtaskButton} onPress={handleAddSubtask}>
                <Text style={styles.addSubtaskButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {subtasks.length > 0 && (
              <View style={styles.subtaskListContainer}>
                {subtasks.map((item, index) => (
                  <View key={item.id} style={styles.subtaskItemRow}>
                    <Text style={styles.subtaskIndex}>{index + 1}</Text>
                    <Text
                      style={[
                        styles.subtaskTitle,
                        item.isCompleted && { textDecorationLine: 'line-through', color: colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveSubtask(item.id)} style={styles.removeSubtaskButton}>
                      <Text style={styles.removeSubtaskButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Pressable
            disabled={!title.trim()}
            onPress={async () => {
              Keyboard.dismiss();
              if (!title.trim()) {
                Alert.alert('Title required', 'Please enter a task title before saving');
                return;
              }
              if (type === 'Progression' && !deadline) {
                Alert.alert('Deadline required', 'Please select a deadline for this progression task.');
                return;
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
                const sharedFields = {
                  title,
                  type: type as 'Simple' | 'Hybrid' | 'Progression',
                  priority: priority as 'Low' | 'Medium' | 'High',
                  rolloverEnabled: allowRollover,
                  recurrenceType,
                  recurrenceInterval: recurrenceType === 'every_n_days' ? Number(recurrenceInterval) || null : null,
                  recurrenceDaysOfWeek: recurrenceType === 'weekly' ? JSON.stringify(recurrenceDaysOfWeek) : null,
                  ...(type === 'Progression' && {
                    totalProgress: Number(targetValue),
                    progressUnit: unit,
                    deadline: deadline ? getLocalDateString(deadline) : null,
                  }),
                };

                if (taskToEdit) {
                  await updateTask(taskToEdit.id, sharedFields);

                  if (type === 'Hybrid') {
                    for (const delId of deletedSubtaskIds) {
                      await deleteTask(delId);
                    }
                    for (const sub of subtasks) {
                      if (sub.isNew) {
                        await insertSubtask(taskToEdit.id, {
                          title: sub.title,
                          scheduledDate: taskToEdit.scheduledDate,
                          priority: priority as 'Low' | 'Medium' | 'High',
                        });
                      }
                    }
                  }
                } else {
                  const createdParent = await addTask({
                    ...sharedFields,
                    scheduledDate: selectedDate,
                  });

                  if (createdParent && type === 'Hybrid' && subtasks.length > 0) {
                    for (const draft of subtasks) {
                      await insertSubtask(createdParent.id, {
                        title: draft.title,
                        scheduledDate: selectedDate,
                        priority: priority as 'Low' | 'Medium' | 'High',
                      });
                    }
                  }

                  if (createdParent && selectedTagIds.length > 0) {
                    for (const tagId of selectedTagIds) {
                      await assignTag(createdParent.id, tagId);
                    }
                  }
                }

                resetForm();
                onTaskCreated();
                if (onClose) onClose();
                sheetRef.current?.close();
              } catch (err) {
                console.error('Failed to save task:', err);
              }
            }}
            style={({ pressed }) => [
              styles.submitButton,
              !title.trim() && styles.submitButtonDisabled,
              pressed && title.trim() ? { opacity: 0.85 } : null,
            ]}
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
  contentContainer: { 
    paddingHorizontal: 20, 
    paddingBottom: 40,
    paddingTop: 8,
  },
  switcherWrapper: {
    marginBottom: 16,
  },
  titleText: { 
    fontSize: 20, 
    fontWeight: '700', 
    textAlign: 'center', 
    marginBottom: 16, 
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  input: { 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 16, 
    backgroundColor: colors.surfaceSubtle, 
    color: colors.textPrimary,
    marginBottom: 16,
  },
  sectionCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 16,
    marginBottom: 16,
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
  },
  rowColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  rowHeader: {
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 12,
  },
  label: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: colors.textPrimary,
  },
  subLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectorGroup: { 
    flexDirection: 'row',
    gap: 6,
  },
  recurrenceSelectorGroup: { 
    flexWrap: 'wrap', 
    justifyContent: 'flex-start', 
    marginTop: 4,
  },
  selectorItem: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8, 
    backgroundColor: colors.surfaceSubtle, 
  },
  selectedItem: { 
    borderColor: colors.selectedBorder, 
    backgroundColor: colors.selectedBg, 
  },
  unselectedText: { 
    color: colors.textSecondary, 
    fontSize: 13,
    fontWeight: '500',
  },
  selectedText: { 
    color: colors.selectedText, 
    fontWeight: '600', 
    fontSize: 13, 
  },
  selectedLow: { 
    backgroundColor: colors.priorityLowBg, 
    borderColor: colors.priorityLowBorder, 
    borderWidth: 1, 
  },
  textLow: { 
    color: colors.priorityLowText, 
    fontWeight: '600', 
    fontSize: 13, 
  },
  selectedMedium: { 
    backgroundColor: colors.priorityMediumBg, 
    borderColor: colors.priorityMediumBorder, 
    borderWidth: 1, 
  },
  textMedium: { 
    color: colors.priorityMediumText, 
    fontWeight: '600', 
    fontSize: 13, 
  },
  selectedHigh: { 
    backgroundColor: colors.priorityHighBg, 
    borderColor: colors.priorityHighBorder, 
    borderWidth: 1, 
  },
  textHigh: { 
    color: colors.priorityHighText, 
    fontWeight: '600', 
    fontSize: 13, 
  },
  inputs: { 
    flex: 1, 
    maxWidth: 160,
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    fontSize: 15, 
    backgroundColor: colors.surfaceSubtle, 
    color: colors.textPrimary,
    textAlign: 'right',
  },
  inlineInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineInput: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 15,
    backgroundColor: colors.surfaceSubtle,
    color: colors.textPrimary,
  },
  unitLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dayOfWeekRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    gap: 6,
  },
  dayPill: { 
    paddingHorizontal: 10, 
    paddingVertical: 8, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8, 
    backgroundColor: colors.surfaceSubtle, 
  },
  subSectionTitle: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: colors.textPrimary, 
    marginBottom: 12, 
  },
  addSubtaskRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    marginBottom: 12, 
  },
  subtaskTextInput: { 
    flex: 1, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    fontSize: 14, 
    backgroundColor: colors.surfaceSubtle, 
    color: colors.textPrimary, 
  },
  addSubtaskButton: { 
    backgroundColor: colors.accent, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  addSubtaskButtonText: { 
    color: colors.textOnAccent, 
    fontWeight: '600', 
    fontSize: 14, 
  },
  subtaskListContainer: { 
    backgroundColor: colors.surfaceSubtle, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  subtaskItemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.borderSubtle, 
  },
  subtaskIndex: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: colors.textMuted, 
    width: 20,
  },
  subtaskTitle: { 
    flex: 1, 
    fontSize: 14, 
    color: colors.textPrimary, 
  },
  removeSubtaskButton: { 
    padding: 4, 
  },
  removeSubtaskButtonText: { 
    fontSize: 14, 
    color: colors.danger, 
    fontWeight: '600', 
  },
  submitContainer: {
    marginTop: 8,
    width: '100%',
  },
  submitButton: { 
    backgroundColor: colors.accent, 
    borderRadius: 12, 
    paddingVertical: 16, 
    alignItems: 'center',
  },
  submitButtonDisabled: { 
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  submitButtonText: { 
    color: colors.textOnAccent, 
    fontSize: 16, 
    fontWeight: '700', 
  },
  deadlinePressable: { 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    backgroundColor: colors.surfaceSubtle, 
    minWidth: 160,
    alignItems: 'flex-end',
  },
  deadlineText: { 
    fontSize: 15, 
    color: colors.textPrimary, 
  },
  deadlinePlaceholder: { 
    fontSize: 15, 
    color: colors.textPlaceholder, 
  },
});