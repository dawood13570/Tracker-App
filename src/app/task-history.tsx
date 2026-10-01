import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTaskHistory } from '../db/queries';
import { useColors } from '../store/themeStore';
import { reportError } from '../utils/errors';

const filters = ['all', 'completed', 'reopened', 'moved', 'skipped', 'rest_day'] as const;
const label = (value: string) => value === 'rest_day' ? 'Rest day' : value.charAt(0).toUpperCase() + value.slice(1);
export default function TaskHistory() {
  const colors = useColors();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getTaskHistory>>>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  useFocusEffect(useCallback(() => { getTaskHistory().then(setRows).catch(reportError); }, []));
  const visible = useMemo(() => rows.filter(row => (filter === 'all' || row.action === filter) && `${row.title} ${row.appDate}`.toLowerCase().includes(search.toLowerCase())), [rows, filter, search]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44 }}><Text style={{ color: colors.accent }}>Back</Text></Pressable>
    <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700' }}>Task history</Text>
    <Text style={{ color: colors.textSecondary, marginVertical: 12 }}>Completions, moves, and rest days recorded since this update. Earlier timestamps cannot be reconstructed.</Text>
    <TextInput accessibilityLabel="Search history by title or date" placeholder="Search title or YYYY-MM-DD" placeholderTextColor={colors.textPlaceholder} value={search} onChangeText={setSearch} style={{ color: colors.textPrimary, backgroundColor: colors.surface, padding: 12, borderRadius: 8 }} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12 }}>{filters.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={{ padding: 10, minHeight: 44 }}><Text style={{ color: filter === value ? colors.accent : colors.textSecondary }}>{label(value)}</Text></Pressable>)}</View>
    <FlatList data={visible} keyExtractor={row => String(row.id)} ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No matching history yet.</Text>} renderItem={({ item }) => {
      let details: { from?: string; to?: string; until?: string } = {};
      try { details = JSON.parse(item.details ?? '{}'); } catch {}
      return <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{item.title}</Text>
        <Text style={{ color: colors.textSecondary }}>{label(item.action)} · App day {item.appDate}</Text>
        {details.from && <Text style={{ color: colors.textSecondary }}>{details.from} → {details.to}</Text>}
        {details.until && <Text style={{ color: colors.textSecondary }}>Resumes {details.until}</Text>}
        <Text style={{ color: colors.textMuted }}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>;
    }} />
  </SafeAreaView>;
}
