// src/components/NoteSheet.tsx
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { createNote, deleteNote, getNotesForScope, updateNoteContent } from '../db/queries';
import { colors } from '../theme/colors';

interface NoteSheetProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  scope: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  dateKey: string;
  periodLabel: string;
  customTitle?: string;
  getSeed: () => Promise<string>;
  onClose?: () => void;
}

export default function NoteSheet({
  sheetRef,
  scope,
  dateKey,
  periodLabel,
  customTitle,
  getSeed,
  onClose,
}: NoteSheetProps) {
  const [notesList, setNotesList] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeContent, setActiveContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const snapPoints = useMemo(() => ['80%', '50%'], []);

  const loadNotes = useCallback(async () => {
    if (!dateKey) return;
    let fetched = await getNotesForScope(scope, dateKey);
    if (fetched.length === 0) {
      const seed = await getSeed();
      await createNote(scope, dateKey, seed, customTitle);
      fetched = await getNotesForScope(scope, dateKey);
    }
    setNotesList(fetched);
  }, [scope, dateKey, getSeed, customTitle]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAddNew = async () => {
    const newNote = await createNote(scope, dateKey, '', customTitle);
    setActiveId(newNote.id);
    setActiveContent('');
    setIsEditing(true);
    await loadNotes();
  };

  const handleSaveActive = async () => {
    Keyboard.dismiss();
    if (activeId !== null) {
      await updateNoteContent(activeId, activeContent);
    }
    setIsEditing(false);
    setActiveId(null);
    await loadNotes();
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this reflection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(id);
          if (activeId === id) {
            setIsEditing(false);
            setActiveId(null);
          }
          await loadNotes();
        },
      },
    ]);
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
        setIsEditing(false);
        setActiveId(null);
        if (onClose) onClose();
      }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.titleText}>{customTitle ? customTitle : `Reflection — ${periodLabel}`}</Text>
            {Boolean(customTitle) && <Text style={styles.subPeriodText}>{periodLabel}</Text>}
          </View>
          {!isEditing && (
            <Pressable onPress={handleAddNew} style={styles.addButton} hitSlop={8}>
              <Ionicons name="add" size={20} color={colors.textOnAccent} />
            </Pressable>
          )}
        </View>

        {isEditing ? (
          <View style={styles.editorContainer}>
            <BottomSheetTextInput
              style={styles.textArea}
              value={activeContent}
              onChangeText={setActiveContent}
              multiline
              placeholder="Reflect on this period..."
              placeholderTextColor={colors.textPlaceholder}
            />
            <View style={styles.editorActions}>
              <Pressable
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => {
                  setIsEditing(false);
                  setActiveId(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.saveBtn]} onPress={handleSaveActive}>
                <Text style={styles.saveBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.notesList}>
            {notesList.map((item) => {
              const dateObj = new Date(item.createdAt);
              const timeString = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' • ' +
                dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <Pressable
                  key={item.id}
                  style={styles.noteCard}
                  onPress={() => {
                    setActiveId(item.id);
                    setActiveContent(item.content ?? '');
                    setIsEditing(true);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTime}>{timeString}</Text>
                    <Pressable onPress={() => handleDelete(item.id)} hitSlop={10}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                  <Text style={styles.cardSnippet} numberOfLines={4}>
                    {item.content || 'Empty note...'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: { padding: 24, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titleText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  subPeriodText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  addButton: { backgroundColor: colors.accent, padding: 6, borderRadius: 20 },
  notesList: { gap: 12 },
  noteCard: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTime: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  cardSnippet: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  editorContainer: { gap: 12 },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: colors.surfaceSubtle,
    color: colors.textPrimary,
    minHeight: 240,
    textAlignVertical: 'top',
  },
  editorActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.accent },
  saveBtnText: { color: colors.textOnAccent, fontSize: 15, fontWeight: '700' },
});