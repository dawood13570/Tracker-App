import { useTagStore } from '@/store/tagStore';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { addDays, format, parseISO } from 'date-fns';
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
import { assignTag, insertSubtask, insertTask } from '../db/queries';
import { colors } from '../theme/colors';
import { getLocalDateString } from '../utils/date';
import { TagPicker } from './TagPicker';

interface SubTaskDraft {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface NewWeeklyTaskModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  weekStartDate: string;
  weekEndDate: string;
  onTaskCreated: () => void;
  onClose?: () => void;
}

const WEEKLY_TASK_TYPES = ['Simple', 'Progression', 'Hybrid'] as const;
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

export default function NewWeeklyTaskModal({
  sheetRef,
  weekStartDate,
  weekEndDate,
  onTaskCreated,
  onClose,
}: NewWeeklyTaskModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'Simple' | 'Progression' | 'Hybrid'>('Simple');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [selectedDayOffsets, setSelectedDayOffsets] = useState<number[]>([]);
  const [shareProgressAcrossDays, setShareProgressAcrossDays] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [subtasks, setSubtasks] = useState<SubTaskDraft[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();
  const snapPoints = useMemo(() => ['75%', '50%'], []);
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const weekDays = useMemo(() => {
    const start = parseISO(weekStartDate);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const dateStr = getLocalDateString(date);
      const isPast = dateStr < todayStr;
      return {
        offset: i,
        label: format(date, 'EEE'),
        dateStr,
        isPast,
      };
    });
  }, [weekStartDate, todayStr]);

  const resetForm = () => {
    setTitle('');
    setType('Simple');
    setPriority('Medium');
    const firstFutureDay = weekDays.find((d) => !d.isPast)?.offset ?? 0;
    setSelectedDayOffsets([firstFutureDay]);
    setShareProgressAcrossDays(false);
    setTargetValue('');
    setUnit('');
    setSubtasks([]);
    setSubtaskInput('');
    setSelectedTagIds([]);
  };

  useEffect(() => {
    loadTags();
    loadMostUsedTags();
    resetForm();
  }, [weekStartDate]);

  const toggleDayOffset = (offset: number, isPast: boolean) => {
    if (isPast) return;
    setSelectedDayOffsets((prev) => {
      if (prev.includes(offset)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((o) => o !== offset);
      } else {
        return [...prev, offset].sort((a, b) => a - b);
      }
    });
  };

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
    if (selectedDayOffsets.length === 0) {
      Alert.alert('Day required', 'Please select at least one active day.');
      return;
    }
    if (type === 'Progression' && (!targetValue || Number(targetValue) <= 0)) {
      Alert.alert('Target required', 'Please enter a valid target for this progression task.');
      return;
    }

    try {
      const chosenDays = selectedDayOffsets.map((o) => weekDays[o].dateStr);

      if (type === 'Progression' && shareProgressAcrossDays) {
        // Linked "Hive-Mind": Creates a parent weekly task and points each selected daily instance to it
        const parentWeekly = await insertTask({
          title: title.trim(),
          type: 'Progression',
          priority,
          scheduledDate: chosenDays[0],
          deadline: weekEndDate,
          scope: 'weekly',
          totalProgress: Number(targetValue),
          progressUnit: unit.trim() || null,
          rolloverEnabled: false,
        });

        for (const dateStr of chosenDays) {
          const childInstance = await insertTask({
            title: title.trim(),
            type: 'Progression',
            priority,
            scheduledDate: dateStr,
            deadline: weekEndDate,
            scope: 'daily',
            sourceTaskId: parentWeekly.id,
            totalProgress: Number(targetValue),
            progressUnit: unit.trim() || null,
            rolloverEnabled: false,
          });
          for (const tagId of selectedTagIds) {
            await assignTag(childInstance.id, tagId);
          }
        }
      } else {
        // Independent instances per day
        for (const dateStr of chosenDays) {
          const created = await insertTask({
            title: title.trim(),
            type,
            priority,
            scheduledDate: dateStr,
            deadline: type === 'Progression' ? weekEndDate : null,
            scope: 'daily',
            totalProgress: type === 'Progression' ? Number(targetValue) : null,
            progressUnit: type === 'Progression' ? unit.trim() || null : null,
            rolloverEnabled: true,
            subtasksTotal: type === 'Hybrid' ? subtasks.length : 0,
          });

          if (created) {
            if (type === 'Hybrid' && subtasks.length > 0) {
              for (const s of subtasks) {
                await insertSubtask(created.id, {
                  title: s.title,
                  scheduledDate: dateStr,
                  priority,
                });
              }
            }
            for (const tagId of selectedTagIds) {
              await assignTag(created.id, tagId);
            }
          }
        }
      }

      resetForm();
      onTaskCreated();
      if (onClose) onClose();
      sheetRef.current?.close();
    } catch (error) {
      console.error('Failed to create weekly task:', error);
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
        <Text style={styles.titleText}>Plan Task for Week</Text>
        <Text style={styles.subTitleText}>Range: {weekStartDate} – {weekEndDate}</Text>

        <BottomSheetTextInput
          style={styles.input}
          placeholder="What do you want to accomplish?"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        {/* Days of Week (Past days disabled) */}
        <View style={styles.row}>
          <Text style={styles.label}>Scheduled Days:</Text>
          <View style={styles.daySelectorRow}>
            {weekDays.map((d) => {
              const isSelected = selectedDayOffsets.includes(d.offset);
              return (
                <Pressable
                  key={d.dateStr}
                  disabled={d.isPast}
                  style={[
                    styles.dayPill,
                    isSelected && styles.dayPillSelected,
                    d.isPast && styles.dayPillDisabled,
                  ]}
                  onPress={() => toggleDayOffset(d.offset, d.isPast)}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      isSelected && styles.dayPillTextSelected,
                      d.isPast && styles.dayPillTextDisabled,
                    ]}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Type:</Text>
          <View style={styles.selectorGroup}>
            {WEEKLY_TASK_TYPES.map((t) => {
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
              <Text style={styles.label}>Target Value:</Text>
              <BottomSheetTextInput
                style={styles.inputNested}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder="70"
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

            {selectedDayOffsets.length > 1 && (
              <View style={[styles.row, { marginTop: 8 }]}>
                <Text style={styles.label}>Share progress across days:</Text>
                <Switch
                  value={shareProgressAcrossDays}
                  onValueChange={setShareProgressAcrossDays}
                />
              </View>
            )}
          </View>
        )}

        {type === 'Hybrid' && (
          <View style={styles.dynamicContainer}>
            <Text style={styles.subSectionTitle}>Subtasks</Text>
            <View style={styles.addSubtaskRow}>
              <BottomSheetTextInput
                style={styles.subtaskInput}
                value={subtaskInput}
                onChangeText={setSubtaskInput}
                placeholder="Enter subtask title..."
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
            <Text style={styles.submitButtonText}>Schedule Tasks</Text>
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
  daySelectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', flex: 1, marginLeft: 8 },
  dayPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayPillSelected: {
    backgroundColor: colors.selectedBg,
    borderColor: colors.selectedBorder,
  },
  dayPillDisabled: {
    opacity: 0.25,
    borderColor: colors.borderSubtle,
  },
  dayPillText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  dayPillTextSelected: { color: colors.selectedText, fontWeight: '700' },
  dayPillTextDisabled: { color: colors.textMuted },
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