import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  assignTagToHabit,
  getTagsForHabit,
  removeTagFromHabit,
} from '../db/queries';
import { HabitWithStatus, useHabitStore } from '../store/habitStore';
import { useTagStore } from '../store/tagStore';
import { colors } from '../theme/colors';
import { AddType, AddTypeSwitcher } from './AddTypeSwitcher';
import { TagPicker } from './TagPicker';

interface NewHabitModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  onHabitCreated: () => void;
  habitToEdit?: HabitWithStatus | null;
  onClose?: () => void;
  onSwitchType?: (type: AddType) => void;
}

const CADENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly_n_times', label: 'N times/week' },
] as const;

export default function NewHabitModal({
  sheetRef,
  onHabitCreated,
  habitToEdit,
  onClose,
  onSwitchType,
}: NewHabitModalProps) {
  const [title, setTitle] = useState('');
  const [cadenceType, setCadenceType] = useState<'daily' | 'weekly_n_times'>('daily');
  const [cadenceTarget, setCadenceTarget] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const { addHabit, updateHabit } = useHabitStore();
  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();

  const snapPoints = useMemo(() => ['65%', '40%'], []);

  const resetForm = () => {
    setTitle('');
    setCadenceType('daily');
    setCadenceTarget('');
    setSelectedTagIds([]);
  };

  useEffect(() => {
    loadTags();
    loadMostUsedTags();
  }, []);

  useEffect(() => {
    if (habitToEdit) {
      setTitle(habitToEdit.title);
      setCadenceType(habitToEdit.cadenceType);
      setCadenceTarget(habitToEdit.cadenceTarget ? String(habitToEdit.cadenceTarget) : '');
      getTagsForHabit(habitToEdit.id).then((rows) => setSelectedTagIds(rows.map((r) => r.id)));
    } else {
      resetForm();
    }
  }, [habitToEdit]);

  const handleToggleTag = async (tagId: number) => {
    const isSelected = selectedTagIds.includes(tagId);
    if (habitToEdit) {
      if (isSelected) {
        await removeTagFromHabit(habitToEdit.id, tagId);
      } else {
        await assignTagToHabit(habitToEdit.id, tagId);
      }
    }
    setSelectedTagIds((prev) =>
      isSelected ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleDeleteTag = async (tagId: number) => {
    if (habitToEdit && selectedTagIds.includes(tagId)) {
      await removeTagFromHabit(habitToEdit.id, tagId);
    }
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    await removeTag(tagId);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a habit title.');
      return;
    }
    if (cadenceType === 'weekly_n_times' && (!cadenceTarget || Number(cadenceTarget) <= 0)) {
      Alert.alert('Target required', 'Enter how many times per week.');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        cadenceType,
        cadenceTarget: cadenceType === 'weekly_n_times' ? Number(cadenceTarget) : undefined,
      };

      if (habitToEdit) {
        await updateHabit(habitToEdit.id, {
          ...payload,
          cadenceTarget: cadenceType === 'weekly_n_times' ? Number(cadenceTarget) : null,
        });
      } else {
        const created = await addHabit(payload);
        if (created && selectedTagIds.length > 0) {
          for (const tagId of selectedTagIds) {
            await assignTagToHabit(created.id, tagId);
          }
        }
      }

      resetForm();
      onHabitCreated();
      if (onClose) onClose();
      sheetRef.current?.close();
    } catch (err) {
      console.error('Failed to save habit:', err);
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
        if (!habitToEdit) resetForm();
        if (onClose) onClose();
      }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        {!habitToEdit && onSwitchType && <AddTypeSwitcher active="Habit" onSelect={onSwitchType} />}
        <Text style={styles.titleText}>{habitToEdit ? 'Edit Habit' : 'New Habit'}</Text>

        <BottomSheetTextInput
          style={styles.input}
          placeholder="Enter Habit Here"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.row}>
          <Text style={styles.label}>Cadence:</Text>
          <View style={styles.selectorGroup}>
            {CADENCE_OPTIONS.map(({ value, label }) => {
              const isSelected = cadenceType === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.selectorItem, isSelected && styles.selectedItem]}
                  onPress={() => setCadenceType(value)}
                >
                  <Text style={isSelected ? styles.selectedText : styles.unselectedText}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {cadenceType === 'weekly_n_times' && (
          <View style={styles.row}>
            <Text style={styles.label}>Times per week:</Text>
            <BottomSheetTextInput
              style={styles.inputs}
              value={cadenceTarget}
              onChangeText={setCadenceTarget}
              placeholder="e.g., 3"
              keyboardType="numeric"
              placeholderTextColor={colors.textPlaceholder}
            />
          </View>
        )}

        <View style={styles.dynamicContainer}>
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

        <View style={{ marginTop: 24, width: '100%', paddingBottom: 40 }}>
          <Pressable
            disabled={!title.trim()}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              !title.trim() && styles.submitButtonDisabled,
              pressed && title.trim() ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={styles.submitButtonText}>{habitToEdit ? 'Update Habit' : 'Add Habit'}</Text>
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
  selectorItem: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surfaceSubtle, marginLeft: 6 },
  selectedItem: { borderColor: colors.selectedBorder, backgroundColor: colors.selectedBg },
  unselectedText: { color: colors.textSecondary, fontSize: 13 },
  selectedText: { color: colors.selectedText, fontWeight: '600', fontSize: 13 },
  inputs: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, backgroundColor: colors.surfaceSubtle, marginLeft: 12, color: colors.textPrimary },
  dynamicContainer: { marginTop: 10, padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  subSectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  submitButton: { backgroundColor: colors.habitAccent, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.surfaceElevated },
  submitButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
});