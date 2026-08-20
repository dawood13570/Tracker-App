import { StyleSheet, Text, View } from 'react-native';
import type { PaceStatus } from '../engine/pace';

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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  Critical: { backgroundColor: '#FEE2E2' },
  CriticalText: { color: '#DC2626' },

  Behind: { backgroundColor: '#FEF3C7' },
  BehindText: { color: '#D97706' },

  'Slightly Behind': { backgroundColor: '#FEF3C7' },
  'Slightly BehindText': { color: '#B45309' },

  'On Track': { backgroundColor: '#DBEAFE' },
  'On TrackText': { color: '#2563EB' },

  Ahead: { backgroundColor: '#DCFCE7' },
  AheadText: { color: '#16A34A' },
});