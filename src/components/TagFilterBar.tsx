import { useTagStore } from '@/store/tagStore';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface TagFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
  onClearAllTags: () => void;
  strictOnly: boolean;
  onToggleStrictOnly: (val: boolean) => void;
}

export function TagFilterBar({
  searchQuery,
  onSearchChange,
  selectedTagIds,
  onToggleTag,
  onClearAllTags,
  strictOnly,
  onToggleStrictOnly,
}: TagFilterBarProps) {
  const { tags: allTags, mostUsedTags } = useTagStore();

  const activeTags = useMemo(
    () => allTags.filter((t) => selectedTagIds.includes(t.id)),
    [allTags, selectedTagIds]
  );

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allTags.filter(
      (t) => t.name.toLowerCase().includes(q) && !selectedTagIds.includes(t.id)
    );
  }, [searchQuery, allTags, selectedTagIds]);

  const quickPicks = useMemo(() => {
    const source = mostUsedTags.length > 0 ? mostUsedTags : allTags.slice(0, 6);
    return source.filter((t) => !selectedTagIds.includes(t.id));
  }, [mostUsedTags, allTags, selectedTagIds]);

  return (
    <View style={styles.container}>
      {/* Search Input for Text & Tags */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items or filter tags..."
          placeholderTextColor={colors.textPlaceholder}
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8} style={styles.clearInputBtn}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tag Autocomplete Dropdown List */}
      {searchSuggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          <Text style={styles.subHeading}>Suggested tags:</Text>
          <View style={styles.chipRow}>
            {searchSuggestions.map((tag) => (
              <TouchableOpacity
                key={`suggest-${tag.id}`}
                style={[styles.suggestChip, { borderColor: tag.color ?? colors.accent }]}
                onPress={() => {
                  onToggleTag(tag.id);
                  onSearchChange('');
                }}
              >
                <Text style={styles.suggestChipText}>+ {tag.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Selected Filter Tags */}
      {activeTags.length > 0 && (
        <View style={styles.activeRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeScroll}>
            {activeTags.map((tag) => (
              <View
                key={`active-${tag.id}`}
                style={[styles.activeChip, { backgroundColor: tag.color ?? colors.accent }]}
              >
                <Text style={styles.activeChipText}>{tag.name}</Text>
                <TouchableOpacity
                  onPress={() => onToggleTag(tag.id)}
                  hitSlop={8}
                  style={styles.removeChipBtn}
                >
                  <Ionicons name="close" size={12} color={colors.textOnAccent} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity onPress={onClearAllTags} style={styles.clearAllBtn} hitSlop={6}>
              <Text style={styles.clearAllText}>Clear</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Strict Filter vs Prioritized Toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              {strictOnly ? 'Only tagged items' : 'Tagged items first'}
            </Text>
            <Switch
              value={strictOnly}
              onValueChange={onToggleStrictOnly}
              trackColor={{ false: colors.surfaceSubtle, true: colors.accent }}
              thumbColor={colors.textOnAccent}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </View>
      )}

      {/* Quick Access Tags */}
      {!searchQuery && quickPicks.length > 0 && selectedTagIds.length === 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPickRow}>
          <Text style={styles.quickPickLabel}>Quick filter:</Text>
          {quickPicks.map((tag) => (
            <TouchableOpacity
              key={`quick-${tag.id}`}
              style={styles.quickChip}
              onPress={() => onToggleTag(tag.id)}
            >
              <Text style={styles.quickChipText}>{tag.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearInputBtn: { padding: 4 },
  suggestionsBox: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: colors.surfaceElevated,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  subHeading: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
  },
  suggestChipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  activeRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  activeScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  activeChipText: { fontSize: 12, fontWeight: '700', color: colors.textOnAccent },
  removeChipBtn: {
    padding: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  clearAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllText: { fontSize: 11, color: colors.danger, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  toggleLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginRight: 4,
    fontWeight: '500',
  },
  quickPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  quickPickLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginRight: 2,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});