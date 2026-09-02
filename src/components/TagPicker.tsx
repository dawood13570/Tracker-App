import { Tag } from '@/store/tagStore';
import { colors } from '@/theme/colors';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TagPickerProps {
  allTags: Tag[];
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  onDeleteTag: (tagId: number) => void; // 1. Added onDeleteTag prop
}

export function TagPicker({
  allTags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
  onDeleteTag, // 1. Destructured here
}: TagPickerProps) {
  const [newTagName, setNewTagName] = useState('');

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const created = await onCreateTag(name);
    onToggleTag(created.id);
    setNewTagName('');
  };

  return (
    <View>
      <View style={styles.chipRow}>
        {allTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            // 2. Replaced the single Pressable with this compound chip
            <View
              key={tag.id}
              style={[
                styles.chip,
                isSelected && {
                  backgroundColor: tag.color ?? colors.accent,
                  borderColor: tag.color ?? colors.accent,
                },
              ]}
            >
              <Pressable
                onPress={() => onToggleTag(tag.id)}
                style={styles.chipTouchArea}
              >
                <Text style={isSelected ? styles.chipTextSelected : styles.chipText}>
                  {tag.name}
                </Text>
              </Pressable>
              <Pressable onPress={() => onDeleteTag(tag.id)} hitSlop={8}>
                <Text
                  style={[
                    styles.chipDeleteX,
                    isSelected && { color: colors.textOnAccent },
                  ]}
                >
                  ✕
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.createRow}>
        <BottomSheetTextInput
          style={styles.createInput}
          placeholder="New tag..."
          placeholderTextColor={colors.textPlaceholder}
          value={newTagName}
          onChangeText={setNewTagName}
          onSubmitEditing={handleCreate}
        />
        <Pressable onPress={handleCreate} style={styles.createButton}>
          <Text style={styles.createButtonText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row', // Align label and '✕' horizontally
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    gap: 6,
  },
  chipTouchArea: {
    justifyContent: 'center',
  },
  chipDeleteX: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    fontSize: 13,
    color: colors.textOnAccent,
    fontWeight: '600',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    backgroundColor: colors.surfaceSubtle,
    color: colors.textPrimary,
    marginRight: 8,
  },
  createButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    color: colors.textOnAccent,
    fontWeight: '600',
    fontSize: 13,
  },
});