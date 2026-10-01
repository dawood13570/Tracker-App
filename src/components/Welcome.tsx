import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useColors } from '../store/themeStore';
import { reportError } from '../utils/errors';
export function Welcome() {
  const colors = useColors();
  const [visible, setVisible] = useState(() => Storage.getItemSync('reckon-onboarded') !== 'true');
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} style={{ maxHeight: '85%', backgroundColor: colors.surface, borderRadius: 16 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700' }}>Make room for what matters</Text>
        <Text style={{ color: colors.textPrimary }}>Today holds tasks, habits, events, and activity logs. Horizon breaks longer goals into manageable work. Pursuits connect all of these with your reflections.</Text>
        <Text style={{ color: colors.textSecondary }}>Rollover carries unfinished work forward. With Repeat enabled, the carried task stays a single occurrence; completing it schedules the next repeat.</Text>
        <Text style={{ color: colors.textSecondary }}>Notes keep local drafts. Summary snapshots are saved only when you ask. Your data stays on this device; use Account → Export backup to keep a separate copy.</Text>
        <Text style={{ color: colors.textSecondary }}>Working after midnight? Account lets you choose when your day ends. You can change these preferences any time.</Text>
        <Pressable accessibilityRole="button" onPress={() => { try { Storage.setItemSync('reckon-onboarded', 'true'); setVisible(false); } catch (error) { reportError(error); } }} style={{ minHeight: 48, justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 8 }}><Text style={{ color: colors.textOnAccent, textAlign: 'center', fontWeight: '700' }}>Get started</Text></Pressable>
      </ScrollView>
    </View>
  </Modal>;
}
