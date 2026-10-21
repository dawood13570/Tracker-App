import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { getProgressLogsByTask, getCurrentProgress, getEffectiveProgress } from '../db/queries';
import { getSurplusPolicy, setSurplusPolicy, requestProgressChange } from '../services/progress';
import { useColors } from '../store/themeStore';
import { reportError } from '../utils/errors';
import type { Task } from '../store/taskStore';
import type { PaceResult } from '../engine/pace';
export default function ProgressLogSheet({ sheetRef, task, currentProgress, onLogged, onClose }: {
 sheetRef: React.RefObject<BottomSheet | null>; task: Task | null; currentProgress: number; onLogged: () => void; onClose?: () => void; pace?: PaceResult;
}) {
 const colors = useColors();
 const [policy,setPolicy] = useState<ReturnType<typeof getSurplusPolicy>>(null);
 const [actual,setActual] = useState(currentProgress);
 const [correct,setCorrect] = useState(false); const [own,setOwn] = useState(0);
 const [amount,setAmount] = useState(''); const [note,setNote] = useState('');
 const [history,setHistory] = useState<Awaited<ReturnType<typeof getProgressLogsByTask>>>([]);
 const [busy,setBusy] = useState(false); const lock = useRef(false);
 const snapPoints = useMemo(() => ['60%','85%'],[]);
 useEffect(() => { setAmount(''); setNote(''); setCorrect(false); if(task) { setPolicy(getSurplusPolicy(task.id)); getProgressLogsByTask(task.id).then(setHistory).catch(reportError); getCurrentProgress(task.id).then(setOwn).catch(reportError); getEffectiveProgress(task.id).then(setActual).catch(reportError); } },[task]);
 const save = async () => {
  if(!task || lock.current) return; const parsed = Number(amount);
  if(!amount.trim() || !Number.isFinite(parsed) || (correct ? parsed < 0 : parsed <= 0)) { reportError(new Error('Enter a valid amount (zero is allowed for corrections).')); return; }
  lock.current=true; setBusy(true);
  try { const current = await getCurrentProgress(task.id); if(await requestProgressChange(task.id,correct ? parsed : current+parsed,note.trim() || null)) { onLogged(); sheetRef.current?.close(); setAmount('');setNote(''); } }
  catch(error) { reportError(error); } finally { lock.current=false;setBusy(false); }
 };
 return <BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose backgroundStyle={{backgroundColor:colors.surface}} onClose={onClose} keyboardBehavior="interactive">
  <BottomSheetScrollView contentContainerStyle={{padding:20,gap:12}} keyboardShouldPersistTaps="handled">
   <Text style={{color:colors.textPrimary,fontSize:20,fontWeight:'700'}}>{task?.title}</Text>
   <Text style={{color:colors.textSecondary}}>{Number(actual.toFixed(2))}/{task?.totalProgress} {task?.progressUnit}</Text>
   {policy && !policy.occurrenceTarget && <Pressable accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={() => Alert.alert('Future surplus', 'Existing bank credit is kept. Choose how later extra work is handled.', [
    {text:'Ask each time',onPress:()=>{try{setSurplusPolicy(task!.id,'none');setPolicy(getSurplusPolicy(task!.id));}catch(error){reportError(error);}}},
    {text:'Bank automatically',onPress:()=>{try{setSurplusPolicy(task!.id,'bank_it');setPolicy(getSurplusPolicy(task!.id));}catch(error){reportError(error);}}},
    {text:'Ease future pace',onPress:()=>{try{setSurplusPolicy(task!.id,'breathing_room');setPolicy(getSurplusPolicy(task!.id));}catch(error){reportError(error);}}},
   ])}><Text style={{color:colors.accent}}>Surplus: {policy.surplusMode === 'bank_it' ? 'Bank automatically' : policy.surplusMode === 'breathing_room' ? 'Ease future pace' : 'Ask each time'} · Change</Text></Pressable>}
   {(task?.bankCovered ?? 0) > 0 && <Text style={{color:colors.accent}}>Covered by bank: {task?.bankCovered} {task?.progressUnit}. Logging actual work frees that coverage for later.</Text>}
   <Pressable accessibilityRole="button" onPress={() => { setCorrect(!correct); setAmount(''); }} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent}}>{correct ? 'Switch to adding progress' : 'Correct recorded progress'}</Text></Pressable>
   {correct && <Text style={{color:colors.textSecondary}}>This task has {own} recorded directly. Enter its corrected total. Work recorded on child tasks is edited on those tasks.</Text>}
   <BottomSheetTextInput accessibilityLabel={correct ? 'Corrected recorded total' : 'Progress amount to add'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={correct ? 'Corrected total' : 'Amount to add'} placeholderTextColor={colors.textPlaceholder} style={{color:colors.textPrimary,padding:12}} />
   <BottomSheetTextInput accessibilityLabel="Progress note" value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={colors.textPlaceholder} style={{color:colors.textPrimary,padding:12}} />
   <Pressable accessibilityRole="button" disabled={busy} onPress={save} style={{padding:12}}><Text style={{color:colors.accent}}>{busy?'Saving…':correct?'Save correction':'Log progress'}</Text></Pressable>
   <Text style={{color:colors.textPrimary,fontWeight:'700'}}>History</Text>
   {history.map(log => <View key={log.id} style={{paddingVertical:8}}><Text style={{color:colors.textPrimary}}>{log.amount > 0 ? '+' : ''}{log.amount} {task?.progressUnit} · {log.creditDate ?? log.appDate ?? log.loggedAt.slice(0,10)} · {log.kind}</Text>{log.notes && <Text style={{color:colors.textSecondary}}>{log.notes}</Text>}</View>)}
  </BottomSheetScrollView>
 </BottomSheet>;
}
