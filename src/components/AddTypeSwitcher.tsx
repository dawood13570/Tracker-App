import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export type AddType = 'Task' | 'Habit' | 'Event' | 'Activity';

interface AddTypeSwitcherProps {
  active: AddType;
  onSelect: (type: AddType) => void;
}

const TYPE_COLORS: Record<AddType, string> = {
  Task: colors.taskAccent,
  Habit: colors.habitAccent,
  Event: colors.eventAccent,
  Activity: colors.activityAccent ?? '#4ade80',
};

const TYPES: AddType[] = ['Task', 'Habit', 'Event', 'Activity'];

export function AddTypeSwitcher({ active, onSelect }: AddTypeSwitcherProps) {
  return (
    <View style={styles.row}>
      {TYPES.map((type) => {
        const isActive = active === type;
        const typeColor = TYPE_COLORS[type];
        return (
          <Pressable
            key={type}
            onPress={() => onSelect(type)}
            style={[
              styles.tab,
              isActive
                ? { backgroundColor: typeColor, borderColor: typeColor }
                : { borderColor: colors.border },
            ]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {type.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  tabTextActive: {
    color: colors.textOnAccent,
  },
});