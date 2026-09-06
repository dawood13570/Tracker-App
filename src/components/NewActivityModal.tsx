import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  assignTagToActivity,
  assignTagToActivityLog,
  getTagsForActivity,
  getTagsForActivityLog,
  removeTagFromActivity,
  removeTagFromActivityLog,
  updateActivityLogNote,
} from '../db/queries';
import { ActivityLogWithDetails, useActivityStore } from '../store/activityStore';
import { useTagStore } from '../store/tagStore';
import { colors } from '../theme/colors';
import { AddType, AddTypeSwitcher } from './AddTypeSwitcher';
import { TagPicker } from './TagPicker';

export interface NewActivityModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  entry?: ActivityLogWithDetails | null;
  onActivityCreated?: () => void;
  onClose?: () => void;
  onSwitchType?: (type: AddType) => void;
}

export default function NewActivityModal({
  sheetRef,
  entry,
  onActivityCreated,
  onClose,
  onSwitchType,
}: NewActivityModalProps) {
  const isDetailMode = Boolean(entry);
  const snapPoints = useMemo(() => (isDetailMode ? ['55%', '75%'] : ['60%', '85%']), [isDetailMode]);

  const { addActivityEntry, masters, loadMasters } = useActivityStore();
  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();

  // --- Create-mode state ---
  const [title, setTitle] = useState('');
  const [matchedMasterId, setMatchedMasterId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [masterTagIds, setMasterTagIds] = useState<number[]>([]);
  const [extraTagIds, setExtraTagIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Detail-mode state ---
  const [detailNote, setDetailNote] = useState('');
  const [detailMasterTagIds, setDetailMasterTagIds] = useState<number[]>([]);
  const [detailExtraTagIds, setDetailExtraTagIds] = useState<number[]>([]);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const resetCreateForm = () => {
    setTitle('');
    setMatchedMasterId(null);
    setNote('');
    setMasterTagIds([]);
    setExtraTagIds([]);
  };

  useEffect(() => {
    loadTags();
    loadMostUsedTags();
    loadMasters();
  }, []);

  useEffect(() => {
    if (entry) {
      setDetailNote(entry.note ?? '');
      Promise.all([getTagsForActivity(entry.activityId), getTagsForActivityLog(entry.id)]).then(
        ([masterRows, logRows]) => {
          setDetailMasterTagIds(masterRows.map((r) => r.id));
          setDetailExtraTagIds(logRows.map((r) => r.id));
        }
      );
    } else {
      resetCreateForm();
    }
  }, [entry]);

  const suggestions = useMemo(() => {
    const q = title.trim().toLowerCase();
    if (!q) return [];
    return masters.filter((m) => m.title.toLowerCase().includes(q)).slice(0, 6);
  }, [title, masters]);

  const handleTitleChange = (text: string) => {
    setTitle(text);
    setMatchedMasterId(null);
  };

  const handlePickSuggestion = async (masterId: number, masterTitle: string) => {
    setTitle(masterTitle);
    setMatchedMasterId(masterId);
    const rows = await getTagsForActivity(masterId);
    setMasterTagIds(rows.map((r) => r.id));
  };

  const handleToggleMasterTag = (tagId: number) => {
    setMasterTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleToggleExtraTag = (tagId: number) => {
    setExtraTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleDeleteTag = async (tagId: number) => {
    setMasterTagIds((prev) => prev.filter((id) => id !== tagId));
    setExtraTagIds((prev) => prev.filter((id) => id !== tagId));
    await removeTag(tagId);
  };

  const handleCreateActivity = async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert('Name required', 'Please enter an activity name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addActivityEntry({
        title: title.trim(),
        note: note.trim() || null,
        masterTagIds,
        extraTagIds,
      });

      if (created) {
        resetCreateForm();
        onActivityCreated?.();
        onClose?.();
        sheetRef.current?.close();
      }
    } catch (err) {
      console.error('Failed to save activity:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Detail-mode handlers ---

  const handleToggleDetailMasterTag = async (tagId: number) => {
    if (!entry) return;
    const isSelected = detailMasterTagIds.includes(tagId);
    if (isSelected) {
      await removeTagFromActivity(entry.activityId, tagId);
    } else {
      await assignTagToActivity(entry.activityId, tagId);
    }
    setDetailMasterTagIds((prev) => (isSelected ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleToggleDetailExtraTag = async (tagId: number) => {
    if (!entry) return;
    const isSelected = detailExtraTagIds.includes(tagId);
    if (isSelected) {
      await removeTagFromActivityLog(entry.id, tagId);
    } else {
      await assignTagToActivityLog(entry.id, tagId);
    }
    setDetailExtraTagIds((prev) => (isSelected ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleDeleteDetailTag = async (tagId: number) => {
    if (!entry) return;
    if (detailMasterTagIds.includes(tagId)) {
      await removeTagFromActivity(entry.activityId, tagId);
    }
    if (detailExtraTagIds.includes(tagId)) {
      await removeTagFromActivityLog(entry.id, tagId);
    }
    setDetailMasterTagIds((prev) => prev.filter((id) => id !== tagId));
    setDetailExtraTagIds((prev) => prev.filter((id) => id !== tagId));
    await removeTag(tagId);
  };

  const handleSaveNote = async () => {
    if (!entry) return;
    setIsSavingNote(true);
    Keyboard.dismiss();
    try {
      await updateActivityLogNote(entry.id, detailNote.trim() || null);
      onActivityCreated?.();
    } catch (err) {
      console.error('Failed to update note:', err);
    } finally {
      setIsSavingNote(false);
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
        resetCreateForm();
        onClose?.();
      }}
    >
      {isDetailMode && entry ? (
        <BottomSheetScrollView contentContainerStyle={styles.detailContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.titleText}>{entry.activityTitle}</Text>
          <Text style={styles.subTitle}>Logged {entry.date}</Text>

          <BottomSheetTextInput
            style={styles.input}
            placeholder="Note..."
            placeholderTextColor={colors.textPlaceholder}
            value={detailNote}
            onChangeText={setDetailNote}
          />
          <Pressable
            disabled={isSavingNote}
            onPress={handleSaveNote}
            style={({ pressed }) => [styles.logBtn, { alignSelf: 'flex-start', marginTop: 8 }, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.logBtnText}>Save Note</Text>
          </Pressable>

          <View style={[styles.dynamicContainer, { marginTop: 16 }]}>
            <Text style={styles.subSectionTitle}>Category tags (all "{entry.activityTitle}" entries)</Text>
            <TagPicker
              allTags={allTags}
              mostUsedTags={mostUsedTags}
              selectedTagIds={detailMasterTagIds}
              onToggleTag={handleToggleDetailMasterTag}
              onCreateTag={(name) => addTag({ name })}
              onDeleteTag={handleDeleteDetailTag}
            />
          </View>

          <View style={[styles.dynamicContainer, { marginBottom: 24 }]}>
            <Text style={styles.subSectionTitle}>Just for this entry</Text>
            <TagPicker
              allTags={allTags}
              mostUsedTags={mostUsedTags}
              selectedTagIds={detailExtraTagIds}
              onToggleTag={handleToggleDetailExtraTag}
              onCreateTag={(name) => addTag({ name })}
              onDeleteTag={handleDeleteDetailTag}
            />
          </View>
        </BottomSheetScrollView>
      ) : (
        <BottomSheetScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {onSwitchType && <AddTypeSwitcher active="Activity" onSelect={onSwitchType} />}
          <Text style={styles.titleText}>New Activity</Text>

          <BottomSheetTextInput
            style={styles.input}
            placeholder="Enter Activity Here..."
            placeholderTextColor={colors.textPlaceholder}
            value={title}
            onChangeText={handleTitleChange}
          />

          {suggestions.length > 0 && !matchedMasterId && (
            <View style={styles.suggestionBox}>
              {suggestions.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => handlePickSuggestion(m.id, m.title)}
                  style={styles.suggestionRow}
                >
                  <Text style={styles.suggestionText}>{m.title}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {matchedMasterId && (
            <Text style={styles.matchedHint}>Reusing existing "{title}" category and its tags.</Text>
          )}

          <BottomSheetTextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder="Note for today (optional)..."
            placeholderTextColor={colors.textPlaceholder}
            value={note}
            onChangeText={setNote}
          />

          <View style={styles.dynamicContainer}>
            <Text style={styles.subSectionTitle}>
              {matchedMasterId ? 'Category tags' : 'Category tags (applies every time you use this name)'}
            </Text>
            <TagPicker
              allTags={allTags}
              mostUsedTags={mostUsedTags}
              selectedTagIds={masterTagIds}
              onToggleTag={handleToggleMasterTag}
              onCreateTag={(name) => addTag({ name })}
              onDeleteTag={handleDeleteTag}
            />
          </View>

          <View style={styles.dynamicContainer}>
            <Text style={styles.subSectionTitle}>Just for this entry</Text>
            <TagPicker
              allTags={allTags}
              mostUsedTags={mostUsedTags}
              selectedTagIds={extraTagIds}
              onToggleTag={handleToggleExtraTag}
              onCreateTag={(name) => addTag({ name })}
              onDeleteTag={handleDeleteTag}
            />
          </View>

          <View style={{ marginTop: 24, width: '100%', paddingBottom: 40 }}>
            <Pressable
              disabled={!title.trim() || isSubmitting}
              onPress={handleCreateActivity}
              style={({ pressed }) => [
                styles.submitButton,
                (!title.trim() || isSubmitting) && styles.submitButtonDisabled,
                pressed && title.trim() ? { opacity: 0.85 } : null,
              ]}
            >
              <Text style={styles.submitButtonText}>Add Activity</Text>
            </Pressable>
          </View>
        </BottomSheetScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: { padding: 24 },
  detailContainer: { padding: 24 },
  titleText: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6, color: colors.textPrimary },
  subTitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.surfaceSubtle,
    color: colors.textPrimary,
  },
  suggestionBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  suggestionText: { fontSize: 14, color: colors.textPrimary },
  matchedHint: { fontSize: 12, color: colors.accent, marginTop: 6, fontStyle: 'italic' },
  dynamicContainer: { marginTop: 10, padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  subSectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  submitButton: { backgroundColor: colors.selectedBorder, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.surfaceElevated },
  submitButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
  logBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logBtnText: { color: colors.textOnAccent, fontWeight: '600', fontSize: 13 },
});