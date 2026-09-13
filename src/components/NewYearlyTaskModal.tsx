import { useTagStore } from '@/store/tagStore';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { assignTag, insertSubtask, insertTask, updateTask } from '../db/queries';
import { colors } from '../theme/colors';
import { TagPicker } from './TagPicker';

interface SubTaskDraft {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface NewYearlyTaskModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  yearStartDate: string;
  yearEndDate: string;
  editTask?: any | null;
  onTaskCreated: () => void;
  onClose?: () => void;
}

const YEARLY_TASK_TYPES = ['Simple', 'Progression', 'Hybrid'] as const;
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

export default function NewYearlyTaskModal({
  sheetRef,
  yearStartDate,
  yearEndDate,
  editTask,
  onTaskCreated,
  onClose,
}: NewYearlyTaskModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'Simple' | 'Progression' | 'Hybrid'>('Simple');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [subtasks, setSubtasks] = useState<SubTaskDraft[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [isRecurringGoal, setIsRecurringGoal] = useState(false);
  const [occurrenceCount, setOccurrenceCount] = useState('');
  const [maxGapDays, setMaxGapDays] = useState(1);

  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();
  const snapPoints = useMemo(() => ['75%', '50%'], []);

  const formattedYearLabel = useMemo(() => {
    try {
      return format(parseISO(yearStartDate), 'yyyy');
    } catch {
      return `${yearStartDate} – ${yearEndDate}`;
    }
  }, [yearStartDate, yearEndDate]);

  const periodLengthDays = useMemo(() => {
    try {
      return differenceInCalendarDays(parseISO(yearEndDate), parseISO(yearStartDate)) + 1;
    } catch {
      return 365;
    }
  }, [yearStartDate, yearEndDate]);

  const maxPossibleGap = useMemo(() => {
    const n = Number(occurrenceCount);
    if (!n || n <= 0) return periodLengthDays;
    return Math.max(1, Math.floor(periodLengthDays / n));
  }, [occurrenceCount, periodLengthDays]);

  useEffect(() => {
    setMaxGapDays((prev) => Math.min(prev, maxPossibleGap));
  }, [maxPossibleGap]);

  const resetForm = () => {
    setTitle('');
    setType('Simple');
    setPriority('Medium');
    setTargetValue('');
    setUnit('');
    setSubtasks([]);
    setSubtaskInput('');
    setSelectedTagIds([]);
    setIsRecurringGoal(false);
    setOccurrenceCount('');
    setMaxGapDays(1);
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
      // NEW
      if (editTask.type === 'Simple' && editTask.totalProgress) {
        setIsRecurringGoal(true);
        setOccurrenceCount(String(editTask.totalProgress));
        setMaxGapDays(editTask.maxGapDays ?? 1);
      } else {
        setIsRecurringGoal(false);
      }
    }
  }, [editTask, yearStartDate]);

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks((prev) => [...prev, { id: `temp-${Date.now()}`, title: subtaskInput.trim(), isCompleted: false }]);
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
      Alert.alert('Target required', 'Please enter a valid target for this yearly goal.');
      return;
    }
    if (type === 'Simple' && isRecurringGoal && (!occurrenceCount || Number(occurrenceCount) <= 0)) {
      Alert.alert('Count required', 'Enter how many times this year.');
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
          maxGapDays: type === 'Simple' && isRecurringGoal ? maxGapDays : null,
        });
      } else {
        const parentYearly = await insertTask({
          title: title.trim(),
          type,
          priority,
          scheduledDate: yearStartDate,
          deadline: yearEndDate,
          scope: 'yearly',
          totalProgress:
            type === 'Progression' ? Number(targetValue)
            : type === 'Simple' && isRecurringGoal ? Number(occurrenceCount)
            : null,
          progressUnit: type === 'Progression' ? unit.trim() || null : null,
          maxGapDays: type === 'Simple' && isRecurringGoal ? maxGapDays : null,
          rolloverEnabled: false,
          subtasksTotal: type === 'Hybrid' ? subtasks.length : 0,
        });

        if (parentYearly) {
          if (type === 'Hybrid' && subtasks.length > 0) {
            for (const s of subtasks) {
              await insertSubtask(parentYearly.id, { title: s.title, scheduledDate: yearStartDate, priority });
            }
          }
          for (const tagId of selectedTagIds) {
            await assignTag(parentYearly.id, tagId);
          }
        }
      }

      resetForm();
      onTaskCreated();
      if (onClose) onClose();
      sheetRef.current?.close();
    } catch (error) {
      console.error('Failed to save yearly goal:', error);
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
        <Text style={styles.titleText}>{editTask ? 'Edit Yearly Goal' : 'Plan Goal for Year'}</Text>
        <Text style={styles.subTitleText}>Year: {formattedYearLabel}</Text>

        <BottomSheetTextInput
          style={styles.input}
          placeholder="What's the big goal this year?"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.row}>
          <Text style={styles.label}>Type:</Text>
          <View style={styles.selectorGroup}>
            {YEARLY_TASK_TYPES.map((t) => (
              <Pressable key={t} style={[styles.selectorItem, type === t && styles.selectedItem]} onPress={() => setType(t)}>
                <Text style={type === t ? styles.selectedText : styles.unselectedText}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Priority:</Text>
          <View style={styles.selectorGroup}>
            {PRIORITY_OPTIONS.map((p) => (
              <Pressable key={p} style={[styles.selectorItem, priority === p && styles.selectedItem]} onPress={() => setPriority(p)}>
                <Text style={priority === p ? styles.selectedText : styles.unselectedText}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {type === 'Progression' && (
          <View style={styles.dynamicContainer}>
            <View style={styles.row}>
              <Text style={styles.label}>Total Yearly Target:</Text>
              <BottomSheetTextInput
                style={styles.inputNested}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder="3000"
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
                placeholder="pages, km, reps"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>
          </View>
        )}

        {type === 'Simple' && (
          <View style={styles.dynamicContainer}>
            <View style={styles.row}>
              <Text style={styles.label}>Repeat this goal:</Text>
              <Switch value={isRecurringGoal} onValueChange={setIsRecurringGoal} trackColor={{ false: colors.borderSubtle, true: colors.accent }} />
            </View>

            {isRecurringGoal && (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Times this year:</Text>
                  <BottomSheetTextInput
                    style={styles.inputNested}
                    value={occurrenceCount}
                    onChangeText={setOccurrenceCount}
                    placeholder="e.g. 24"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textPlaceholder}
                  />
                </View>

                <Text style={[styles.label, { marginTop: 8 }]}>
                  Max gap between occurrences: {maxGapDays} day{maxGapDays > 1 ? 's' : ''}
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
                  Spaced to hit your target by year's end, pulled closer if you fall behind — never more than {maxPossibleGap} day{maxPossibleGap > 1 ? 's' : ''} apart given {occurrenceCount || '—'} times.
                </Text>
              </>
            )}
          </View>
        )}

        {type === 'Hybrid' && !editTask && (
          <View style={styles.dynamicContainer}>
            <Text style={styles.subSectionTitle}>Milestones</Text>
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
              onToggleTag={(tagId) => setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))}
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
            style={({ pressed }) => [styles.submitButton, !title.trim() && styles.submitDisabled, pressed && title.trim() ? { opacity: 0.85 } : null]}
          >
            <Text style={styles.submitButtonText}>{editTask ? 'Save Changes' : 'Schedule Yearly Goal'}</Text>
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
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: colors.surfaceSubtle, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
  label: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  selectorGroup: { flexDirection: 'row' },
  selectorItem: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surfaceSubtle, marginLeft: 6 },
  selectedItem: { borderColor: colors.selectedBorder, backgroundColor: colors.selectedBg },
  unselectedText: { color: colors.textSecondary, fontSize: 12 },
  selectedText: { color: colors.selectedText, fontWeight: '600', fontSize: 12 },
  dynamicContainer: { marginTop: 10, padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  inputNested: { flex: 1.5, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 15, backgroundColor: colors.surfaceSubtle, marginLeft: 12, color: colors.textPrimary },
  hintText: { fontSize: 11, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' },
  subSectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  subtaskInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, backgroundColor: colors.surfaceSubtle, marginRight: 8, color: colors.textPrimary },
  addBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  addBtnText: { color: colors.textOnAccent, fontWeight: '600', fontSize: 13 },
  subtaskItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  subtaskTitle: { color: colors.textPrimary, fontSize: 13 },
  removeText: { color: colors.danger, fontWeight: 'bold' },
  submitButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitDisabled: { backgroundColor: colors.surfaceElevated },
  submitButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '700' },
});