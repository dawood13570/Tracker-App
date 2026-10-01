import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { createNote, getPursuitEntities, getTaskByDate, getAllLinkableTasks, setEntityPursuit, getActivityLogs, logActivity, logHabitCompletion, getHabitsByDate, type PursuitEntityKind } from '../db/queries';
import { useColors } from '../store/themeStore';
import { getAppToday } from '../utils/date';
import { reportError } from '../utils/errors';

type Entity = { id: number; title: string | null; pursuitId: number | null; content?: string | null; startTime?: string; endTime?: string | null; location?: string | null };
export function PursuitContents({ pursuitId, onOpenNote, onChanged }: { pursuitId: number; onOpenNote: (id: number) => void; onChanged: () => void }) {
  const colors = useColors();
  const [data, setData] = useState<Awaited<ReturnType<typeof getPursuitEntities>> | null>(null);
  const [choices, setChoices] = useState<Entity[]>([]);
  const [kind, setKind] = useState<PursuitEntityKind | null>(null);
  const [search, setSearch] = useState('');
  const [habitDone, setHabitDone] = useState<Record<number, boolean>>({});
  const [logs, setLogs] = useState<Record<number, Awaited<ReturnType<typeof getActivityLogs>>>>({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [contents, habits] = await Promise.all([getPursuitEntities(pursuitId), getHabitsByDate(getAppToday())]);
    setData(contents); setHabitDone(Object.fromEntries(habits.map(h => [h.id, h.isCompletedToday])));
    const history = await Promise.all(contents.activities.map(async a => [a.id, await getActivityLogs(a.id)] as const));
    setLogs(Object.fromEntries(history));
  }, [pursuitId]);
  useEffect(() => { load().catch(reportError); }, [load]);
  const action = async (work: () => Promise<unknown>) => {
    if (busy) return; setBusy(true);
    try { await work(); await load(); onChanged(); } catch (error) { reportError(error); } finally { setBusy(false); }
  };
  const pick = async (type: PursuitEntityKind) => {
    try {
      const all = await getPursuitEntities();
      const rows = type === 'task' ? await getAllLinkableTasks() : type === 'habit' ? all.habits : type === 'event' ? all.events : type === 'activity' ? all.activities : all.notes;
      setChoices(rows.filter(r => r.pursuitId == null)); setKind(type); setSearch('');
    } catch (error) { reportError(error); }
  };
  const button = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={onPress} style={{ minHeight: 44, paddingVertical: 12 }}><Text style={{ color: colors.accent }}>{label}</Text></Pressable>;
  const section = (label: string, type: PursuitEntityKind, rows: Entity[]) => <View style={{ marginTop: 16 }}>
    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{label} ({rows.length})</Text>
    {button(`Link existing ${type}`, () => void pick(type))}
    {rows.map(item => <View key={item.id} style={{ padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: 8 }}>
      <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{item.title || item.content?.slice(0, 80) || 'Untitled reflection'}</Text>
      {type === 'event' && <Text style={{ color: colors.textSecondary }}>{item.startTime?.replace('T', ' ')}{item.endTime ? ` → ${item.endTime.replace('T', ' ')}` : ''}{item.location ? `\n${item.location}` : ''}</Text>}
      {type === 'habit' && button(habitDone[item.id] ? 'Undo today’s log' : 'Log today', () => void action(() => logHabitCompletion(item.id, getAppToday())))}
      {type === 'activity' && <>
        <Text style={{ color: colors.textSecondary }}>Last done: {logs[item.id]?.[0]?.date ?? 'Never logged'}</Text>
        {button('Log now', () => void action(() => logActivity({ activityId: item.id, date: getAppToday() })))}
        {(logs[item.id] ?? []).slice(0, 5).map(log => <Text key={log.id} style={{ color: colors.textSecondary }}>{log.date}{log.note ? ` — ${log.note}` : ''}</Text>)}
      </>}
      {type === 'note' && button('Open reflection', () => onOpenNote(item.id))}
      {button('Unlink from this pursuit', () => void action(() => setEntityPursuit(type, item.id, null)))}
    </View>)}
  </View>;
  return <View>
    {button('Link an existing task', () => void pick('task'))}
    {kind && <View style={{ padding: 12, backgroundColor: colors.surfaceSubtle }}>
      <Text style={{ color: colors.textPrimary }}>Choose a {kind}</Text>
      <TextInput accessibilityLabel={`Search ${kind}s to link`} placeholder="Search unlinked items" placeholderTextColor={colors.textPlaceholder} value={search} onChangeText={setSearch} style={{ color: colors.textPrimary, minHeight: 44 }} />
      {choices.filter(c => `${c.title ?? ''} ${c.content ?? ''}`.toLowerCase().includes(search.toLowerCase())).map(c => <View key={c.id}>{button(c.title || c.content?.slice(0, 60) || 'Untitled', () => void action(async () => { await setEntityPursuit(kind, c.id, pursuitId); setKind(null); }))}</View>)}
      {!choices.length && <Text style={{ color: colors.textSecondary }}>No unlinked items. Create one from Today or Notes, then choose this pursuit.</Text>}
      {button('Cancel linking', () => setKind(null))}
    </View>}
    {section('HABITS', 'habit', data?.habits ?? [])}
    {section('EVENTS', 'event', data?.events ?? [])}
    {section('ACTIVITIES', 'activity', data?.activities ?? [])}
    {section('REFLECTIONS', 'note', data?.notes ?? [])}
    {button('Write a pursuit reflection', () => void action(async () => { const note = await createNote('daily', getAppToday(), '', undefined, false, pursuitId); onOpenNote(note.id); }))}
  </View>;
}
