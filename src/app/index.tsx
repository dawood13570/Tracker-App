// app/index.tsx
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { drizzle, useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { syncLogs } from '../db/schema'; // Ensure this matches your schema path
import { useStore } from '../store/useStore'; 
import { executeSyncRoutine, scheduleFiveMinuteTimer } from '../tasks/background';      // Our Zustand memory corkboard store

export default function AppDashboard() {
  // 1. Gain active access to the physical open database instance on disk
  const expoDb = useSQLiteContext();
  const db = drizzle(expoDb);

  // 2. Consume shared variables and functions from our Zustand store
  const isSidebarOpen = useStore((state) => state.isSidebarOpen);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const userId = useStore((state) => state.userId);
  const setUserId = useStore((state) => state.setUserId);

  // Local state to track profile identity configurations
  const [isLogged, setIsLogged] = useState(false);

  // 3. Drizzle Live Query: Listens to the SQLite binary file natively.
  // If rows alter anywhere in the app process (even in the background), this array refreshes instantly.
  const { data: logs } = useLiveQuery(db.select().from(syncLogs));

  const handleProfileToggle = () => {
    if (!isLogged) {
      setUserId("USER_DAWOOD_77");
      setIsLogged(true);
    } else {
      setUserId(null);
      setIsLogged(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER ZONE */}
        <Text style={styles.headerTitle}>System Architecture</Text>
        <Text style={styles.dateSubtitle}>Active Environment Monitor</Text>

        {/* --- SECTION 1: ZUSTAND STATE CONTROL --- */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🧠 Zustand Store (Memory RAM State)</Text>
          
          <View style={styles.metricRow}>
            <Text style={styles.label}>Sidebar Parameter:</Text>
            <Text style={[styles.value, { color: isSidebarOpen ? '#03DAC6' : '#CF6679' }]}>
              {isSidebarOpen ? "OPEN" : "CLOSED"}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.label}>Active Identity Token:</Text>
            <Text style={[styles.value, { color: userId ? '#BB86FC' : '#666' }]}>
              {userId ?? "EMPTY (NULL)"}
            </Text>
          </View>

<View style={styles.buttonActionRow}>
  <TouchableOpacity style={styles.actionButton} onPress={toggleSidebar}>
    <Text style={styles.buttonText}>Toggle Sidebar</Text>
  </TouchableOpacity>

{/* TEAL FORCE SYNC TEST TRIGGER */}
<TouchableOpacity 
  style={[styles.actionButton, { backgroundColor: '#03DAC6' }]} 
  onPress={async () => {
    // 1. Run the database row insert right now
    await executeSyncRoutine(); 
    // 2. Schedule the hardware lock screen alarm for 5 minutes from now
    await scheduleFiveMinuteTimer(); 
  }}
>
  <Text style={[styles.buttonText, { color: '#121212' }]}>Force Sync</Text>
</TouchableOpacity>

  <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={handleProfileToggle}>
    <Text style={styles.buttonText}>{isLogged ? "Clear Profile" : "Assign Profile"}</Text>
  </TouchableOpacity>
</View>
        </View>

        {/* --- SECTION 2: DRIZZLE PERSISTENT LOGS --- */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>💾 SQLite Storage (Disk File Monitor)</Text>
          <Text style={styles.description}>
            The rows below display persistent records stored inside the database binary. 
            When a background fetch executes, a new timestamp row will inject automatically.
          </Text>

          <View style={styles.logContainer}>
            {logs && logs.length > 0 ? (
              logs.map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <Text style={styles.logStatus}>[{log.status}]</Text>
                  <Text style={styles.logTime}>{log.timestamp}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No background iterations recorded yet.</Text>
            )}
          </View>
        </View>

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