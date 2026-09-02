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
  const { tags: allTags, loadTags, addTag, removeTag } = useTagStore();
  const [ selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [subtasks, setSubtasks] = useState<SubTaskDraft[]>([]);
  const [deletedSubtaskIds, setDeletedSubtaskIds] = useState<number[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const snapPoints = useMemo(() => ['60%', '35%'], []);

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
    // If it's an existing database subtask, mark it for deletion upon save
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

      // Load existing real subtasks from SQLite
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
  }, []);

  useEffect(() => {
    if (taskToEdit) {
      getTagsForTask(taskToEdit.id).then((rows) => setSelectedTagIds(rows.map((r) => r.id)));
    } else {
      setSelectedTagIds([]);
    }
  }, [taskToEdit]);

  // Uncheck or check a tag for this specific task
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
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        {!taskToEdit && onSwitchType && <AddTypeSwitcher active="Task" onSelect={onSwitchType} />}
        <Text style={styles.titleText}>{taskToEdit ? 'Edit Task' : 'New Task Input'}</Text>
        

        <BottomSheetTextInput
          style={styles.input}
          placeholder="Enter Task Here"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.row}>
          <Text style={styles.label}>Type:</Text>
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

        <View style={styles.row}>
          <Text style={styles.label}>Priority:</Text>
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

        <View style={styles.dynamicContainer}>
          <Text style={styles.subSectionTitle}>Tags</Text>
          <TagPicker
            allTags={allTags}
            selectedTagIds={selectedTagIds}
            onToggleTag={handleToggleTag}
            onCreateTag={(name) => addTag({ name })}
            onDeleteTag={handleDeleteTag}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Rollover Task:</Text>
          <Switch value={allowRollover} onValueChange={setAllowRollover} />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Repeats:</Text>
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
          <View style={styles.dynamicContainer}>
            <View style={styles.row}>
              <Text style={styles.label}>Repeat every:</Text>
              <BottomSheetTextInput
                style={styles.inputs}
                value={recurrenceInterval}
                onChangeText={setRecurrenceInterval}
                placeholder="3"
                keyboardType="numeric"
                placeholderTextColor="#b0b0b0"
              />
              <Text style={[styles.label, { marginLeft: 8 }]}>days</Text>
            </View>
          </View>
        )}

        {recurrenceType === 'weekly' && (
          <View style={styles.dynamicContainer}>
            <Text style={styles.subSectionTitle}>Repeat on:</Text>
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
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* PROGRESSION TASK INPUTS */}
        {type === 'Progression' && (
          <View style={styles.dynamicContainer}>
            <View style={styles.row}>
              <Text style={styles.label}>Target Value: </Text>
              <BottomSheetTextInput
                style={styles.inputs}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder="e.g., 100"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Unit:</Text>
              <BottomSheetTextInput
                style={styles.inputStyleNested}
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g., kg, miles, reps"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Deadline:</Text>
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
          <View style={styles.dynamicContainer}>
            <Text style={styles.subSectionTitle}>Subtasks</Text>

            <View style={styles.addSubtaskRow}>
              <BottomSheetTextInput
                style={styles.subtaskTextInput}
                value={subtaskInput}
                onChangeText={setSubtaskInput}
                placeholder="Enter subtask title..."
                placeholderTextColor="#999"
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
                    <Text style={styles.subtaskIndex}>{index + 1}.</Text>
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
        <View style={{ marginTop: 24, width: '100%', paddingBottom: 40 }}>
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
                    // 1. Delete removed subtasks
                    for (const delId of deletedSubtaskIds) {
                      await deleteTask(delId);
                    }
                    // 2. Insert newly added subtasks
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
            <Text style={styles.submitButtonText}>{taskToEdit ? 'Update Task' : 'Submit Task'}</Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: { padding: 24 },
  titleText: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20, color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: colors.surfaceSubtle, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
  label: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  selectorGroup: { flexDirection: 'row' },
  recurrenceSelectorGroup: { flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 },
  selectorItem: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surfaceSubtle, marginLeft: 6 },
  selectedItem: { borderColor: colors.selectedBorder, backgroundColor: colors.selectedBg },
  unselectedText: { color: colors.textSecondary, fontSize: 13 },
  selectedText: { color: colors.selectedText, fontWeight: '600', fontSize: 13 },
  selectedLow: { backgroundColor: colors.priorityLowBg, borderColor: colors.priorityLowBorder, borderWidth: 1.5 },
  textLow: { color: colors.priorityLowText, fontWeight: '600', fontSize: 13 },
  selectedMedium: { backgroundColor: colors.priorityMediumBg, borderColor: colors.priorityMediumBorder, borderWidth: 1.5 },
  textMedium: { color: colors.priorityMediumText, fontWeight: '600', fontSize: 13 },
  selectedHigh: { backgroundColor: colors.priorityHighBg, borderColor: colors.priorityHighBorder, borderWidth: 1.5 },
  textHigh: { color: colors.priorityHighText, fontWeight: '600', fontSize: 13 },
  inputs: { flex: 1.5, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, backgroundColor: colors.surfaceSubtle, marginLeft: 12, color: colors.textPrimary },
  inputStyleNested: { flex: 1.5, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, backgroundColor: colors.surfaceSubtle, marginLeft: 12, color: colors.textPrimary },
  dynamicContainer: { marginTop: 10, padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  dayOfWeekRow: { flexDirection: 'row', flexWrap: 'wrap' },
  dayPill: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surfaceSubtle, marginRight: 6, marginBottom: 6 },
  subSectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  subtaskTextInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: colors.surfaceSubtle, marginRight: 8, color: colors.textPrimary },
  addSubtaskButton: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  addSubtaskButtonText: { color: colors.textOnAccent, fontWeight: '600', fontSize: 14 },
  subtaskListContainer: { marginTop: 8, backgroundColor: colors.surfaceSubtle, borderRadius: 6, borderWidth: 1, borderColor: colors.borderSubtle },
  subtaskItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  subtaskIndex: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginRight: 6 },
  subtaskTitle: { flex: 1, fontSize: 13, color: colors.textPrimary },
  removeSubtaskButton: { padding: 4, marginLeft: 8 },
  removeSubtaskButtonText: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  submitButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.surfaceElevated },
  submitButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
  deadlinePressable: { flex: 1.5, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surfaceSubtle, marginLeft: 12 },
  deadlineText: { fontSize: 16, color: colors.textPrimary },
  deadlinePlaceholder: { fontSize: 16, color: colors.textPlaceholder },
});