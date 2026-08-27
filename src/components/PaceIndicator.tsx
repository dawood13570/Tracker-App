import { StyleSheet, Text, View } from 'react-native';
import type { PaceStatus } from '../engine/pace';
import { colors } from '../theme/colors';

interface PaceIndicatorProps {
    status: PaceStatus;
}

export function PaceIndicator({ status }: PaceIndicatorProps) {
    return (
        <View style={[styles.badge, styles[status]]}>
            <Text style={[styles.badgeText, styles[`${status}Text` as keyof typeof styles]]}>
                {status}
            </Text>
        </View>
    );
}


const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },

  Critical: { backgroundColor: colors.paceCriticalBg },
  CriticalText: { color: colors.paceCriticalText },

  Behind: { backgroundColor: colors.paceBehindBg },
  BehindText: { color: colors.paceBehindText },

  'Slightly Behind': { backgroundColor: colors.paceSlightlyBehindBg },
  'Slightly BehindText': { color: colors.paceSlightlyBehindText },

  'On Track': { backgroundColor: colors.paceOnTrackBg },
  'On TrackText': { color: colors.paceOnTrackText },

  Ahead: { backgroundColor: colors.paceAheadBg },
  AheadText: { color: colors.paceAheadText },
});