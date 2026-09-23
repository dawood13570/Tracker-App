// selectionIndicator.tsx
import { useColors } from '@/store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

interface SelectionIndicatorProps {
  isSelected: boolean;
}

export function SelectionIndicator({ isSelected }: SelectionIndicatorProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.circle,
        {
          borderColor: isSelected ? colors.accent : colors.textMuted ?? '#888888',
          backgroundColor: isSelected ? colors.accent : 'transparent',
        },
      ]}
    >
      {isSelected && (
        <Ionicons name="checkmark" size={14} color={colors.textOnAccent ?? '#ffffff'} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});