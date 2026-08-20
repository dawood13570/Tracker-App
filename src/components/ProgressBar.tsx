// src/components/ProgressBar.tsx
import { StyleSheet, Text, View } from 'react-native';

interface ProgressBarProps {
    current: number;
    target: number;
    unit?: string | null;
}

export function ProgressBar({ current, target, unit }: ProgressBarProps) {
    const ratio = target > 0 ? current / target : 0;
    const clampedRatio = Math.min(Math.max(ratio, 0), 1);

    let fillColor = '#F44336';
  if (ratio >= 1) {
    fillColor = '#4CAF50';
  } else if (ratio >= 0.3) {
    fillColor = '#FFC107';
  }

  const percentage = Math.round(clampedRatio * 100);

  return (
    <View style={styles.container}>
        <Text style={styles.label}>
            {current} / {target} {unit || ''} ({percentage} %)
        </Text>
        <View style={styles.track}>
            <View
          style={[
            styles.fill,
            { width: `${clampedRatio * 100}%`, backgroundColor: fillColor },
          ]}
          />
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    color: '#444444',
    fontWeight: '500',
    marginBottom: 6,
  },
  track: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});