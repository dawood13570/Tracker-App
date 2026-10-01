import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getProgressLogsByTask, getCurrentProgress } from '../db/queries';
import { requestProgressChange } from '../services/progress';
import { useColors } from '../store/themeStore';
import { reportError } from '../utils/errors';
import type { Task } from '../store/taskStore';
import type { PaceResult } from '../engine/pace';
export default function ProgressLogSheet({ sheetRef, task, currentProgress, onLogged, onClose }: {
 sheetRef: React.RefObject<BottomSheet | null>; task: Task | null; currentProgress: number; onLogged: () => void; onClose?: () => void; pace?: PaceResult;
}) {
 const colors = useColors();
 const [amount,setAmount] = useState(''); const [note,setNote] = useState('');
 const [history,setHistory] = useState<Awaited<ReturnType<typeof getProgressLogsByTask>>>([]);
 const [busy,setBusy] = useState(false); const lock = useRef(false);
 const snapPoints = useMemo(() => ['60%','85%'],[]);
 useEffect(() => { setAmount(''); setNote(''); if(task) getProgressLogsByTask(task.id).then(setHistory).catch(reportError); },[task]);
 const save = async () => {
  if(!task || lock.current) return; const parsed = Number(amount);
  if(!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) { reportError(new Error('Enter a positive, finite amount.')); return; }
  lock.current=true; setBusy(true);
  try { const current = await getCurrentProgress(task.id); if(await requestProgressChange(task.id,current+parsed,note.trim() || null)) { onLogged(); sheetRef.current?.close(); setAmount('');setNote(''); } }
  catch(error) { reportError(error); } finally { lock.current=false;setBusy(false); }
 };
 return <BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose backgroundStyle={{backgroundColor:colors.surface}} onClose={onClose} keyboardBehavior="interactive">
  <BottomSheetScrollView contentContainerStyle={{padding:20,gap:12}} keyboardShouldPersistTaps="handled">
   <Text style={{color:colors.textPrimary,fontSize:20,fontWeight:'700'}}>{task?.title}</Text>
   <Text style={{color:colors.textSecondary}}>{currentProgress}/{task?.totalProgress} {task?.progressUnit}</Text>
   <BottomSheetTextInput accessibilityLabel="Progress amount to add" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount to add" placeholderTextColor={colors.textPlaceholder} style={{color:colors.textPrimary,padding:12}} />
   <BottomSheetTextInput accessibilityLabel="Progress note" value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={colors.textPlaceholder} style={{color:colors.textPrimary,padding:12}} />
   <Pressable accessibilityRole="button" disabled={busy} onPress={save} style={{padding:12}}><Text style={{color:colors.accent}}>{busy?'Saving…':'Log progress'}</Text></Pressable>
   <Text style={{color:colors.textPrimary,fontWeight:'700'}}>History</Text>
   {history.map(log => <View key={log.id} style={{paddingVertical:8}}><Text style={{color:colors.textPrimary}}>{log.amount > 0 ? '+' : ''}{log.amount} {task?.progressUnit} · {log.appDate ?? log.loggedAt.slice(0,10)} · {log.kind}</Text>{log.notes && <Text style={{color:colors.textSecondary}}>{log.notes}</Text>}</View>)}
  </BottomSheetScrollView>
 </BottomSheet>;
}
