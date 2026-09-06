import BottomSheet, {
  BottomSheetFlatList,
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
  getTagsForActivity,
  removeTagFromActivity,
} from '../db/queries';
import {
  ActivityLogRow,
  ActivityWithLastLog,
  useActivityStore,
} from '../store/activityStore';
import { useTagStore } from '../store/tagStore';
import { colors } from '../theme/colors';
import { AddType, AddTypeSwitcher } from './AddTypeSwitcher';
import { TagPicker } from './TagPicker';

export interface NewActivityModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  activity?: ActivityWithLastLog | null;
  onActivityCreated?: () => void;
  onClose?: () => void;
  onSwitchType?: (type: AddType) => void;
}

export default function NewActivityModal({
  sheetRef,
  activity,
  onActivityCreated,
  onClose,
  onSwitchType,
}: NewActivityModalProps) {
  const isDetailMode = Boolean(activity);
  const snapPoints = useMemo(() => (isDetailMode ? ['65%', '85%'] : ['60%', '40%']), [isDetailMode]);

  const { addActivity, quickLog, getHistory } = useActivityStore();
  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();

  const [title, setTitle] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [logImmediately, setLogImmediately] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [history, setHistory] = useState<ActivityLogRow[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetCreateForm = () => {
    setTitle('');
    setInitialNote('');
    setLogImmediately(false);
    setSelectedTagIds([]);
  };

  useEffect(() => {
    loadTags();
    loadMostUsedTags();
  }, []);

  useEffect(() => {
    if (activity) {
      getHistory(activity.id).then(setHistory);
      getTagsForActivity(activity.id).then((rows) => setSelectedTagIds(rows.map((r) => r.id)));
      setNoteText('');
    } else {
      setHistory([]);
      resetCreateForm();
    }
  }, [activity]);

  const handleToggleTag = async (tagId: number) => {
    const isSelected = selectedTagIds.includes(tagId);
    if (activity) {
      if (isSelected) {
        await removeTagFromActivity(activity.id, tagId);
      } else {
        await assignTagToActivity(activity.id, tagId);
      }
    }
    setSelectedTagIds((prev) =>
      isSelected ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleDeleteTag = async (tagId: number) => {
    if (activity && selectedTagIds.includes(tagId)) {
      await removeTagFromActivity(activity.id, tagId);
    }
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    await removeTag(tagId);
  };

  const handleCreateActivity = async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter an activity title.');
      return;
    }

    try {
      const created = await addActivity(title.trim());
      if (created) {
        if (selectedTagIds.length > 0) {
          for (const tagId of selectedTagIds) {
            await assignTagToActivity(created.id, tagId);
          }
        }
        if (logImmediately) {
          await quickLog(created.id, initialNote.trim() || null);
        }
      }

      resetCreateForm();
      if (onActivityCreated) onActivityCreated();
      if (onClose) onClose();
      sheetRef.current?.close();
    } catch (err) {
      console.error('Failed to save activity:', err);
    }
  };

  const handleLogHistory = async () => {
    if (!activity) return;
    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      await quickLog(activity.id, noteText.trim() ? noteText.trim() : null);
      const updated = await getHistory(activity.id);
      setHistory(updated);
      setNoteText('');
    } catch (err) {
      console.error('Failed to log entry:', err);
    } finally {
      setIsSubmitting(false);
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
        if (onClose) onClose();
      }}
    >
      {isDetailMode && activity ? (
        <View style={styles.detailContainer}>
          <Text style={styles.titleText}>{activity.title}</Text>
          <Text style={styles.subTitle}>Activity History</Text>

          <View style={styles.logBox}>
            <BottomSheetTextInput
              style={styles.input}
              placeholder="Add note for today..."
              placeholderTextColor={colors.textPlaceholder}
              value={noteText}
              onChangeText={setNoteText}
            />
            <Pressable
              disabled={isSubmitting}
              onPress={handleLogHistory}
              style={({ pressed }) => [styles.logBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.logBtnText}>Log Today</Text>
            </Pressable>
          </View>

          <View style={[styles.dynamicContainer, { marginBottom: 12 }]}>
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

          <BottomSheetFlatList
            data={history}
            keyExtractor={(item) => `log-${item.id}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.logItem}>
                <View style={styles.logItemHeader}>
                  <Text style={styles.logDate}>{item.date}</Text>
                  <Text style={styles.logTime}>{item.createdAt.slice(11, 16)}</Text>
                </View>
                {Boolean(item.note) && <Text style={styles.logNote}>{item.note}</Text>}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No logs recorded yet.</Text>
              </View>
            }
          />
        </View>
      ) : (
        <BottomSheetScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {onSwitchType && <AddTypeSwitcher active="Activity" onSelect={onSwitchType} />}
          <Text style={styles.titleText}>New Activity</Text>

          <BottomSheetTextInput
            style={styles.input}
            placeholder="e.g., Oil Change, Dentist, Guitar strings..."
            placeholderTextColor={colors.textPlaceholder}
            value={title}
            onChangeText={setTitle}
          />

          <View style={styles.row}>
            <Text style={styles.label}>Log first entry now:</Text>
            <Pressable
              onPress={() => setLogImmediately((prev) => !prev)}
              style={[styles.toggleChip, logImmediately && styles.toggleChipActive]}
            >
              <Text style={logImmediately ? styles.toggleChipTextActive : styles.toggleChipText}>
                {logImmediately ? 'Yes' : 'No'}
              </Text>
            </Pressable>
          </View>

          {logImmediately && (
            <BottomSheetTextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Optional note for this first entry..."
              placeholderTextColor={colors.textPlaceholder}
              value={initialNote}
              onChangeText={setInitialNote}
            />
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
              onPress={handleCreateActivity}
              style={({ pressed }) => [
                styles.submitButton,
                !title.trim() && styles.submitButtonDisabled,
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
  detailContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  label: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  toggleChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surfaceSubtle,
  },
  toggleChipActive: { borderColor: colors.selectedBorder, backgroundColor: colors.selectedBg },
  toggleChipText: { fontSize: 13, color: colors.textSecondary },
  toggleChipTextActive: { fontSize: 13, color: colors.selectedText, fontWeight: '600' },
  dynamicContainer: { marginTop: 10, padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  subSectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  submitButton: { backgroundColor: colors.selectedBorder, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.surfaceElevated },
  submitButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
  logBox: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  logBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logBtnText: { color: colors.textOnAccent, fontWeight: '600', fontSize: 13 },
  listContent: { paddingBottom: 24 },
  logItem: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  logItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logDate: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  logTime: { fontSize: 12, color: colors.textMuted },
  logNote: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  emptyContainer: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});