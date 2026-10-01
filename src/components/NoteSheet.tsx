import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { createNote, deleteNote, getNotesForScope, updateNoteDetails } from '../db/queries';
import { useColors } from '../store/themeStore';
import { reportError } from '../utils/errors';
import { PursuitPicker } from './PursuitPicker';

type Note = Awaited<ReturnType<typeof getNotesForScope>>[number];
interface Props {
  sheetRef: React.RefObject<BottomSheet | null>;
  scope: Note['scope']; dateKey: string; periodLabel: string;
  customTitle?: string; initialNoteId?: number;
  getSeed: () => Promise<string>; onClose?: () => void;
}
export default function NoteSheet({ sheetRef, scope, dateKey, periodLabel, customTitle, initialNoteId, getSeed, onClose }: Props) {
  const colors = useColors();
  const [list, setList] = useState<Note[]>([]);
  const [active, setActive] = useState<Note | null>(null);
  const [draft, setDraft] = useState({ title: '', content: '', pursuitId: null as number | null });
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const openedId = useRef<number | undefined>(undefined);
  const seedRef = useRef(getSeed); seedRef.current = getSeed;
  const snapPoints = useMemo(() => ['70%', '90%'], []);
  const draftKey = (id: number) => `reckon-note-draft:${id}`;
  const edit = useCallback((note: Note) => {
    let saved;
    try { saved = JSON.parse(Storage.getItemSync(draftKey(note.id)) ?? 'null'); } catch { /* Use saved note if draft is corrupt. */ }
    if (!saved || typeof saved.title !== 'string' || typeof saved.content !== 'string' || (saved.pursuitId !== null && !Number.isSafeInteger(saved.pursuitId))) saved = null;
    setActive(note);
    setDraft(saved ?? { title: note.title ?? '', content: note.content ?? '', pursuitId: note.pursuitId });
  }, []);
  const load = useCallback(async () => {
    if (!dateKey) return;
    const version = ++generation.current;
    try {
      const rows = await getNotesForScope(scope, dateKey);
      if (version !== generation.current) return;
      setList(rows);
      if (initialNoteId && openedId.current !== initialNoteId) {
        const target = rows.find(n => n.id === initialNoteId);
        if (target) { openedId.current = initialNoteId; edit(target); }
      }
      const seed = await seedRef.current();
      if (version === generation.current) setSummary(seed);
    } catch (error) { reportError(error); }
  }, [scope, dateKey, initialNoteId, edit]);
  useEffect(() => { setActive(null); openedId.current = undefined; setSummary(''); void load(); return () => { generation.current++; }; }, [load]);
  const change = (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (active) {
      try { Storage.setItemSync(draftKey(active.id), JSON.stringify(next)); } catch (error) { reportError(error); }
    }
  };
  const save = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      await updateNoteDetails(active.id, draft);
      Storage.removeItemSync(draftKey(active.id)); setActive(null); await load();
    } catch (error) { reportError(error); } finally { setBusy(false); }
  };
  const add = async (generated = false) => {
    if (busy || !dateKey) return; setBusy(true);
    try {
      const note = await createNote(scope, dateKey, generated ? summary : '', customTitle, generated);
      await load(); if (!generated) edit(note);
    } catch (error) { reportError(error); } finally { setBusy(false); }
  };
  const button = (label: string, action: () => void, destructive = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={action} style={{ padding: 12, minHeight: 44 }}>
      <Text style={{ color: destructive ? colors.danger : colors.accent, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  return (
    <BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose keyboardBehavior="interactive"
      backgroundStyle={{ backgroundColor: colors.surface }} onChange={index => { if (index >= 0) void load(); }}
      onClose={() => { setActive(null); openedId.current = undefined; onClose?.(); }}>
      <BottomSheetScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>{customTitle ?? `Reflection — ${periodLabel}`}</Text>
        {active ? <>
          <BottomSheetTextInput accessibilityLabel="Note title" placeholder="Title (optional)" value={draft.title} onChangeText={title => change({ title })} placeholderTextColor={colors.textPlaceholder} style={{ color: colors.textPrimary, padding: 12 }} />
          <PursuitPicker selectedPursuitId={draft.pursuitId} onSelect={pursuitId => change({ pursuitId })} />
          <BottomSheetTextInput accessibilityLabel="Reflection" multiline value={draft.content} onChangeText={content => change({ content })} placeholder="What happened? What did you learn? What comes next?" placeholderTextColor={colors.textPlaceholder} style={{ color: colors.textPrimary, minHeight: 200, textAlignVertical: 'top', padding: 12, backgroundColor: colors.surfaceSubtle, borderRadius: 8 }} />
          <Text style={{ color: colors.textSecondary }}>Draft kept on this device when you close.</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {button('Discard draft', () => Alert.alert('Discard draft?', 'Your last saved note will stay.', [{ text: 'Keep editing' }, { text: 'Discard', style: 'destructive', onPress: () => { Storage.removeItemSync(draftKey(active.id)); setActive(null); } }]), true)}
            {button(busy ? 'Saving…' : 'Save note', () => void save())}
          </View>
        </> : <>
          {button('Write a reflection', () => void add())}
          {summary ? <View style={{ backgroundColor: colors.surfaceSubtle, padding: 12, borderRadius: 8 }}>
            <Text style={{ color: colors.textSecondary }}>Current summary</Text><Text style={{ color: colors.textPrimary, marginTop: 8 }}>{summary}</Text>
            {button('Save summary snapshot', () => void add(true))}
          </View> : null}
          {list.map(note => <View key={note.id} style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 8, padding: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${note.title || 'reflection'}`} onPress={() => edit(note)}>
              <Text style={{ color: colors.textSecondary }}>{note.isAutoGenerated ? 'Summary snapshot' : 'Reflection'} · {note.updatedAt.slice(0, 10)}{Storage.getItemSync(draftKey(note.id)) ? ' · Draft available' : ''}</Text>
              <Text style={{ color: colors.textPrimary, fontWeight: '600', marginTop: 8 }}>{note.title}</Text>
              <Text style={{ color: colors.textPrimary }} numberOfLines={5}>{note.content || 'Empty note — tap to write'}</Text>
            </Pressable>
            {button('Delete', () => Alert.alert('Delete note?', 'This removes the note and its draft.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteNote(note.id); Storage.removeItemSync(draftKey(note.id)); await load(); } catch (error) { reportError(error); } } }]), true)}
          </View>)}
        </>}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
