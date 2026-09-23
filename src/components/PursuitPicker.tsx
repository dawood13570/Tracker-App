// src/components/PursuitPicker.tsx
import { useColors } from '@/store/themeStore';
import { Palette } from '@/theme/colors';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getAllPursuits, insertPursuit, PursuitRow } from '../db/queries';

export interface PursuitPickerProps {
  selectedPursuitId: number | null;
  onSelect: (id: number | null) => void;
}

export function PursuitPicker({ selectedPursuitId, onSelect }: PursuitPickerProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [pursuits, setPursuits] = useState<PursuitRow[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    getAllPursuits().then(setPursuits);
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const created = await insertPursuit({ title: newTitle.trim(), status: 'active' });
    setPursuits((prev) => [created, ...prev]);
    onSelect(created.id);
    setNewTitle('');
    setShowCreate(false);
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <Pressable
          style={[styles.chip, selectedPursuitId === null && styles.chipSelected]}
          onPress={() => onSelect(null)}
        >
          <Text style={selectedPursuitId === null ? styles.chipTextSelected : styles.chipText}>None</Text>
        </Pressable>
        {pursuits.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.chip, selectedPursuitId === p.id && styles.chipSelected]}
            onPress={() => onSelect(p.id)}
          >
            <Text style={selectedPursuitId === p.id ? styles.chipTextSelected : styles.chipText}>{p.title}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.chipCreate} onPress={() => setShowCreate((s) => !s)}>
          <Text style={styles.chipCreateText}>+ New</Text>
        </Pressable>
      </ScrollView>

      {showCreate && (
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="New pursuit title..."
            placeholderTextColor={colors.textPlaceholder}
            onSubmitEditing={handleCreate}
          />
          <Pressable style={styles.createBtn} onPress={handleCreate}>
            <Text style={styles.createBtnText}>Add</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
      marginRight: 6,
    },
    chipSelected: { borderColor: colors.selectedBorder, backgroundColor: colors.selectedBg },
    chipText: { fontSize: 12, color: colors.textSecondary },
    chipTextSelected: { fontSize: 12, fontWeight: '600', color: colors.selectedText },
    chipCreate: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.accent,
    },
    chipCreateText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
    createRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    createInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      fontSize: 13,
      backgroundColor: colors.surfaceSubtle,
      color: colors.textPrimary,
    },
    createBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 6 },
    createBtnText: { color: colors.textOnAccent, fontWeight: '600', fontSize: 13 },
  });