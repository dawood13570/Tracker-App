// src/app/notes-history.tsx
import NoteSheet from '@/components/NoteSheet';
import { getAllNotesSummaries, NoteSummary } from '@/db/queries';
import { generateDailySeed } from '@/engine/notesSeed';
import { colors } from '@/theme/colors';
import { getAppToday } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScopeFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const SCOPE_LABELS: Record<Exclude<ScopeFilter, 'all'>, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
};

function formatNoteDate(scope: NoteSummary['scope'], dateKey: string) {
  try {
    if (scope === 'yearly') return dateKey.slice(0, 4);
    if (scope === 'monthly') return format(parseISO(dateKey), 'MMMM yyyy');
    return format(parseISO(dateKey), 'EEE, MMM d, yyyy');
  } catch {
    return dateKey;
  }
}

export default function NotesHistoryScreen() {
  const insets = useSafeAreaInsets();
  const todayStr = useMemo(() => getAppToday(), []);

  const [notesList, setNotesList] = useState<NoteSummary[]>([]);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  const sheetRef = useRef<BottomSheet>(null);

  const loadNotes = useCallback(async () => {
    setNotesList(await getAllNotesSummaries());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const todaysNote = useMemo(
    () => notesList.find((n) => n.scope === 'daily' && n.dateKey === todayStr) ?? null,
    [notesList, todayStr]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notesList.filter((n) => {
      const matchesScope = scopeFilter === 'all' || n.scope === scopeFilter;
      const matchesText =
        !q ||
        (n.content ?? '').toLowerCase().includes(q) ||
        (n.title ?? '').toLowerCase().includes(q) ||
        n.dateKey.includes(q);
      return matchesScope && matchesText;
    });
  }, [notesList, search, scopeFilter]);

  const openDate = (dateKey: string) => {
    setActiveDateKey(dateKey);
    sheetRef.current?.expand();
  };

  const handlePickDate = (selected?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selected) {
      openDate(format(selected, 'yyyy-MM-dd'));
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Notes</Text>
        <View style={{ width: 24 }} />
      </View>

      <TouchableOpacity style={styles.todayCard} onPress={() => openDate(todayStr)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.todayCardLabel}>TODAY</Text>
          <Text style={styles.todayCardSnippet} numberOfLines={2}>
            {todaysNote?.content || 'No note yet — tap to add one.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.accent} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.addOtherRow} onPress={() => { setPickerDate(new Date()); setShowPicker(true); }}>
        <Ionicons name="calendar-outline" size={16} color={colors.accent} />
        <Text style={styles.addOtherText}>Add a note for another day</Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, selected) => handlePickDate(selected)}
        />
      )}

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor={colors.textPlaceholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {(['all', 'daily', 'weekly', 'monthly', 'yearly', 'custom'] as ScopeFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, scopeFilter === f && styles.filterChipActive]}
            onPress={() => setScopeFilter(f)}
          >
            <Text style={scopeFilter === f ? styles.filterChipTextActive : styles.filterChipText}>
              {f === 'all' ? 'All' : SCOPE_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.listContent}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={28} color={colors.textMuted} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>No notes found.</Text>
          </View>
        ) : (
          filtered.map((note) => (
            <TouchableOpacity key={note.id} style={styles.noteCard} onPress={() => openDate(note.dateKey)}>
              <View style={styles.noteCardHeader}>
                <View style={styles.scopeBadge}>
                  <Text style={styles.scopeBadgeText}>{SCOPE_LABELS[note.scope]}</Text>
                </View>
                <Text style={styles.noteDate}>{formatNoteDate(note.scope, note.dateKey)}</Text>
              </View>
              {note.title ? <Text style={styles.noteTitle}>{note.title}</Text> : null}
              <Text style={styles.noteSnippet} numberOfLines={3}>
                {note.content || 'Empty note...'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <NoteSheet
        sheetRef={sheetRef}
        scope="daily"
        dateKey={activeDateKey ?? ''}
        periodLabel={activeDateKey ? formatNoteDate('daily', activeDateKey) : ''}
        getSeed={() => generateDailySeed(activeDateKey ?? todayStr)}
        onClose={() => {
          setActiveDateKey(null);
          loadNotes();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  pageTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  todayCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10,
    backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.accent, padding: 12,
  },
  todayCardLabel: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 0.6, marginBottom: 4 },
  todayCardSnippet: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  addOtherRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 14 },
  addOtherText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.surfaceSubtle, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 13 },
  filterRow: { marginBottom: 10, flexGrow: 0 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { fontSize: 12, color: colors.textOnAccent, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyText: { fontSize: 13, color: colors.textMuted },
  noteCard: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.borderSubtle, padding: 12, marginBottom: 10 },
  noteCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  scopeBadge: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  scopeBadgeText: { fontSize: 10, fontWeight: '700', color: colors.accent },
  noteDate: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  noteTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  noteSnippet: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});