import { SelectionIndicator } from '@/components/SelectionIndicator';
import { ActivityLogWithDetails } from '@/store/activityStore';
import { colors } from '@/theme/colors';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TagLite {
  id: number;
  name: string;
  color?: string | null;
}

interface ActivityCardProps {
  entry: ActivityLogWithDetails;
  tags: TagLite[]; // resolved tag objects for entry.tagIds, passed in from parent
  selectionMode: boolean;
  isSelected: boolean;
  onPressCard: () => void;
  onLongPressCard: () => void;
  onToggleSelect: () => void;
}

export function ActivityCard({
  entry,
  tags,
  selectionMode,
  isSelected,
  onPressCard,
  onLongPressCard,
  onToggleSelect,
}: ActivityCardProps) {
  const handlePress = () => {
    if (selectionMode) {
      onToggleSelect();
    } else {
      onPressCard();
    }
  };

  return (
    <View style={[styles.card, isSelected && styles.selectedCard]} collapsable={false}>
      <View style={styles.cardInner}>
        <View style={styles.accentBar} />

        <Pressable
          onPress={handlePress}
          onLongPress={onLongPressCard}
          delayLongPress={250}
          style={({ pressed }) => [styles.pressableRow, pressed && styles.cardPressed]}
        >
          <View style={styles.cardRow}>
            {selectionMode && (
              <View style={styles.leadSlot}>
                <SelectionIndicator isSelected={isSelected} />
              </View>
            )}

            <View style={styles.cardContent}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {entry.activityTitle}
              </Text>
              {Boolean(entry.note) && (
                <Text style={styles.noteSnippet} numberOfLines={1}>
                  "{entry.note}"
                </Text>
              )}
              {tags.length > 0 && (
                <View style={styles.tagRow}>
                  {tags.map((tag) => (
                    <View key={tag.id} style={[styles.tagChip, tag.color ? { borderColor: tag.color } : null]}>
                      <Text style={[styles.tagChipText, tag.color ? { color: tag.color } : null]}>{tag.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    minHeight: 56,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selectedCard: { borderColor: colors.accent, backgroundColor: colors.selectedBg },
  cardInner: { flexDirection: 'row', alignItems: 'stretch', minHeight: 56 },
  accentBar: { width: 4, backgroundColor: colors.activityAccent },
  pressableRow: { flex: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  leadSlot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardContent: { flex: 1, justifyContent: 'center' },
  activityTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  noteSnippet: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tagChip: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagChipText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  cardPressed: { opacity: 0.7 },
});