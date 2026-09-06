//selectionIndicator.tsx
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

interface SelectionIndicatorProps {
  isSelected: boolean;
}

export function SelectionIndicator({ isSelected }: SelectionIndicatorProps) {
  return (
    <View style={[styles.circle, isSelected && styles.circleSelected]}>
      {isSelected && <Ionicons name="checkmark" size={14} color={colors.textOnAccent ?? '#ffffff'} />}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted ?? '#888888',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});