// src/components/NewMonthlyTaskModal.tsx
import { useTagStore } from '@/store/tagStore';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { format, parseISO } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { assignTag, insertSubtask, insertTask, updateTask } from '../db/queries';
import { colors } from '../theme/colors';
import { TagPicker } from './TagPicker';

interface SubTaskDraft {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface NewMonthlyTaskModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  monthStartDate: string;
  monthEndDate: string;
  editTask?: any | null;
  onTaskCreated: () => void;
  onClose?: () => void;
}

const MONTHLY_TASK_TYPES = ['Simple', 'Progression', 'Hybrid'] as const;
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

export default function NewMonthlyTaskModal({
  sheetRef,
  monthStartDate,
  monthEndDate,
  editTask,
  onTaskCreated,
  onClose,
}: NewMonthlyTaskModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'Simple' | 'Progression' | 'Hybrid'>('Simple');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [subtasks, setSubtasks] = useState<SubTaskDraft[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();
  const snapPoints = useMemo(() => ['75%', '50%'], []);

  const formattedMonthLabel = useMemo(() => {
    try {
      return format(parseISO(monthStartDate), 'MMMM yyyy');
    } catch {
      return `${monthStartDate} – ${monthEndDate}`;
    }
  }, [monthStartDate, monthEndDate]);

  const resetForm = () => {
    setTitle('');
    setType('Simple');
    setPriority('Medium');
    //setDecomposeToWeekly(false);
    setTargetValue('');
    setUnit('');
    setSubtasks([]);
    setSubtaskInput('');
    setSelectedTagIds([]);
  };

  useEffect(() => {
    loadTags();
    loadMostUsedTags();
    if (editTask) {
      setTitle(editTask.title ?? '');
      setType(editTask.type ?? 'Simple');
      setPriority(editTask.priority ?? 'Medium');
      setTargetValue(editTask.totalProgress ? String(editTask.totalProgress) : '');
      setUnit(editTask.progressUnit ?? '');
    } else {
      resetForm();
    }
  }, [editTask, monthStartDate]);

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, title: subtaskInput.trim(), isCompleted: false },
    ]);
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    if (type === 'Progression' && (!targetValue || Number(targetValue) <= 0)) {
      Alert.alert('Target required', 'Please enter a valid target for this monthly progression task.');
      return;
    }

    try {
      if (editTask) {
        await updateTask(editTask.id, {
          title: title.trim(),
          type,
          priority,
          totalProgress: type === 'Progression' ? Number(targetValue) : null,
          progressUnit: type === 'Progression' ? unit.trim() || null : null,
        });
      } else {
        const parentMonthly = await insertTask({
          title: title.trim(),
          type,
          priority,
          scheduledDate: monthStartDate,
          deadline: monthEndDate,
          scope: 'monthly',
          totalProgress: type === 'Progression' ? Number(targetValue) : null,
          progressUnit: type === 'Progression' ? unit.trim() || null : null,
          rolloverEnabled: false,
          subtasksTotal: type === 'Hybrid' ? subtasks.length : 0,
        });

        if (parentMonthly) {
          if (type === 'Hybrid' && subtasks.length > 0) {
            for (const s of subtasks) {
              await insertSubtask(parentMonthly.id, {
                title: s.title,
                scheduledDate: monthStartDate,
                priority,
              });
            }
          }
          for (const tagId of selectedTagIds) {
            await assignTag(parentMonthly.id, tagId);
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
          <Text style={styles.label}>Type:</Text>
          <View style={styles.selectorGroup}>
            {MONTHLY_TASK_TYPES.map((t) => {
              const isSelected = type === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.selectorItem, isSelected && styles.selectedItem]}
                  onPress={() => setType(t)}
                >
                  <Text style={isSelected ? styles.selectedText : styles.unselectedText}>{t}</Text>
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
              return (
                <Pressable
                  key={p}
                  style={[styles.selectorItem, isSelected && styles.selectedItem]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={isSelected ? styles.selectedText : styles.unselectedText}>{p}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {type === 'Progression' && (
          <View style={styles.dynamicContainer}>
            <View style={styles.row}>
              <Text style={styles.label}>Total Monthly Target:</Text>
              <BottomSheetTextInput
                style={styles.inputNested}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder="300"
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

            {!editTask && (
              <View style={[styles.row, { marginTop: 8 }]}>

              </View>
            )}
          </View>
        )}

        {type === 'Hybrid' && !editTask && (
          <View style={styles.dynamicContainer}>
            <Text style={styles.subSectionTitle}>Milestone Subtasks</Text>
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
                <Text style={styles.subtaskTitle}>{idx + 1}. {s.title}</Text>
                <TouchableOpacity onPress={() => handleRemoveSubtask(s.id)}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {!editTask && (
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

const styles = StyleSheet.create({
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
  subSectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
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
  subtaskItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  subtaskTitle: { color: colors.textPrimary, fontSize: 13 },
  removeText: { color: colors.danger, fontWeight: 'bold' },
  submitButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitDisabled: { backgroundColor: colors.surfaceElevated },
  submitButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '700' },
});