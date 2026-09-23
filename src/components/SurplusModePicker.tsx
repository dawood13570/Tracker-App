import { useColors } from '@/store/themeStore';
import { Palette } from '@/theme/colors';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type SurplusMode = 'breathing_room' | 'raise_bar' | 'bank_it' | 'none';

const OPTIONS: { value: SurplusMode; label: string; desc: string }[] = [
  { value: 'none', label: 'Ask Each Time', desc: 'Choose what to do whenever you beat pace' },
  { value: 'breathing_room', label: 'Ease Pace', desc: "Lower tomorrow's target automatically" },
  { value: 'bank_it', label: 'Bank Buffer', desc: 'Save extra progress as buffer days' },
  { value: 'raise_bar', label: 'Raise Bar', desc: 'Increase the goal target' },
];

export function SurplusModePicker({
  value,
  onChange,
}: {
  value: SurplusMode | null;
  onChange: (m: SurplusMode) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const current = value ?? 'none';

  return (
    <View>
      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const isSelected = current === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onChange(opt.value)}
            >
              <Text style={isSelected ? styles.chipTextSelected : styles.chipText}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{OPTIONS.find((o) => o.value === current)?.desc}</Text>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
    },
    chipSelected: {
      borderColor: colors.selectedBorder,
      backgroundColor: colors.selectedBg,
    },
    chipText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    chipTextSelected: {
      fontSize: 12,
      color: colors.selectedText,
      fontWeight: '700',
    },
    hint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 6,
      fontStyle: 'italic',
    },
  });