// app/index.tsx
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';

export default function AppDashboard() {


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER ZONE */}
        <Text style={styles.headerTitle}>System Architecture</Text>
        <Text style={styles.dateSubtitle}>Active Environment Monitor</Text>


      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
  },
  dateSubtitle: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    marginBottom: 20,
  },
  cardHeader: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    color: '#AAA',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  label: {
    color: '#AAA',
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#BB86FC',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#2D2D2D',
    borderWidth: 1,
    borderColor: '#444',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  logContainer: {
    backgroundColor: '#141414',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
  },
  logRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  logStatus: {
    color: '#03DAC6',
    fontWeight: 'bold',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  logTime: {
    color: '#E0E0E0',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  emptyText: {
    color: '#555',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 36,
    fontSize: 13,
  },
});