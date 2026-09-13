import { colors } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

export function SectionHeader({ title, count, isExpanded, onToggle }: { title: string; count: number; isExpanded: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.sectionHeaderRow} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.sectionHeaderTitle}>
        {title} <Text style={styles.sectionHeaderCount}>{count > 0 ? `(${count})` : ''}</Text>
      </Text>
      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 6,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHeaderCount: {
    fontWeight: '500',
    color: colors.textMuted,
  },
});