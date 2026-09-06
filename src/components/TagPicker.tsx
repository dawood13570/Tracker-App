import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tag } from '../store/tagStore';
import { colors } from '../theme/colors';

interface TagPickerProps {
  allTags: Tag[];
  mostUsedTags: Tag[];
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  onDeleteTag: (tagId: number) => void;
}

function TagChip({
  tag,
  isSelected,
  onPress,
  onDelete,
}: {
  tag: Tag;
  isSelected: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const handleDeletePress = () => {
    Alert.alert(
      'Delete Tag',
      `Delete "${tag.name}"? This removes it from every task, not just this one.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };
  return (
    <View
      style={[styles.chip,isSelected && { backgroundColor: tag.color ?? colors.accent, borderColor: tag.color ?? colors.accent },]}
    >
      <Pressable onPress={onPress}>
        <Text style={isSelected ? styles.chipTextSelected : styles.chipText}>{tag.name}</Text>
      </Pressable>
      <Pressable onPress={handleDeletePress} hitSlop={8} style={styles.chipDeleteX}>
        <Text style={isSelected ? styles.chipTextSelected : styles.chipText}>✕</Text>
      </Pressable>
    </View>
  );
}

export function TagPicker({
  allTags,
  mostUsedTags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
  onDeleteTag,
}: TagPickerProps) {
  const [search, setSearch] = useState('');

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [search, allTags]);

  const hasExactMatch = allTags.some(
    (t) => t.name.toLowerCase() === search.trim().toLowerCase()
  );

  const handleCreate = async () => {
    const name = search.trim();
    if (!name) return;
    const created = await onCreateTag(name);
    onToggleTag(created.id);
    setSearch('');
  };

  return (
    <View>
      {selectedTags.length > 0 && (
        <View style={styles.chipRow}>
          {selectedTags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              isSelected
              onPress={() => onToggleTag(tag.id)}
              onDelete={() => onDeleteTag(tag.id)}
            />
          ))}
        </View>
      )}

      <BottomSheetTextInput
        style={styles.searchInput}
        placeholder="Search or create a tag..."
        placeholderTextColor={colors.textPlaceholder}
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={handleCreate}
      />

      {search.trim().length > 0 ? (
        <View style={styles.resultsBox}>
          {searchResults.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              isSelected={selectedTagIds.includes(tag.id)}
              onPress={() => {
                onToggleTag(tag.id);
                setSearch('');
              }}
              onDelete={() => onDeleteTag(tag.id)}
            />
          ))}

          {!hasExactMatch && (
            <Pressable onPress={handleCreate} style={styles.createChip}>
              <Text style={styles.createChipText}>+ Create "{search.trim()}"</Text>
            </Pressable>
          )}
        </View>
      ) : (
        mostUsedTags.length > 0 && (
          <View style={styles.quickAccessSection}>
            <Text style={styles.quickAccessLabel}>Most used</Text>
            <View style={styles.chipRow}>
              {mostUsedTags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  isSelected={selectedTagIds.includes(tag.id)}
                  onPress={() => onToggleTag(tag.id)}
                  onDelete={() => onDeleteTag(tag.id)}
                />
              ))}
            </View>
          </View>
        )
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    gap: 6,
  },
  chipDeleteX: {
    paddingLeft: 2,
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
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: colors.surfaceSubtle,
    color: colors.textPrimary,
  },
  resultsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  createChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.selectedBg,
  },
  createChipText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  quickAccessSection: {
    marginTop: 10,
  },
  quickAccessLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
});