import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface ProcrastinationBadgeProps {
    count: number;
}

const getBadgeLevel = (count: number) => {
    if (count >= 5) return 'alarming';
    if (count >= 2) return 'moderate';
    return 'subtle';  
};

export function ProcrastinationBadge({ count }: ProcrastinationBadgeProps) {
    if (count === 0) {
        return null;
    }

    const level = getBadgeLevel(count)

    return (
        <View style={[styles.badge, styles[level]]}>
            <Text style={[styles.badgeText, styles[`${level}Text` as keyof typeof styles]]}>+{count} {count === 1 ? 'day' : 'days'}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },

  subtle: { backgroundColor: colors.surfaceElevated },
  subtleText: { color: colors.textSecondary },

  moderate: { backgroundColor: colors.paceBehindBg },
  moderateText: { color: colors.paceBehindText },

  alarming: { backgroundColor: colors.dangerBg },
  alarmingText: { color: colors.danger },
});