// src/components/GhostTaskCard.tsx
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface GhostTaskCardProps {
  title: string;
  priority?: 'Low' | 'Medium' | 'High';
  totalProgress?: number | null;
  progressUnit?: string | null;
}

export function GhostTaskCard({ title, priority = 'Medium', totalProgress, progressUnit }: GhostTaskCardProps) {
  const accentColor =
    priority === 'High'
      ? colors.priorityHighBorder ?? '#ef4444'
      : priority === 'Medium'
      ? colors.priorityMediumBorder ?? '#eab308'
      : colors.priorityLowBorder ?? '#22c55e';

  return (
    <View style={styles.card}>
      <View style={[styles.priorityAccent, { backgroundColor: accentColor }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.dashedBox}>
            <Ionicons name="sparkles-outline" size={12} color={colors.textMuted} />
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PLANNED</Text>
          </View>
        </View>

        {totalProgress != null && totalProgress > 0 && (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Target: {totalProgress} {progressUnit ?? ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderSubtle,
    opacity: 0.75,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  priorityAccent: {
    width: 4,
    opacity: 0.5,
  },
  body: {
    flex: 1,
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dashedBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  badge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  metaRow: {
    marginTop: 6,
    paddingLeft: 26,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});