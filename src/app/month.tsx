import { colors } from '@/theme/colors';
import { StyleSheet, Text, View } from 'react-native';

export default function MonthScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monthly Overview</Text>
      <Text style={styles.subtitle}>Scheduled for Milestone 6.2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
  },
});