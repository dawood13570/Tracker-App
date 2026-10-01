import { eq } from 'drizzle-orm';
import { Alert } from 'react-native';
import { db } from '../db/client';
import { tasks } from '../db/schema';
import { getCurrentProgress } from '../db/queries';
import { advanceCoveredRepeats, changeProgress, commitProgressAction } from '../db/lifecycle';
import { bankRoot, readPlanData, rangeEnd } from '../db/planData';
import { reconcileQuantityPlans } from '../db/quantityPlanning';
import { getSurplusChoices, getDaysRemaining } from '../engine/pace';
import { getAppToday } from '../utils/date';
import { parseISO } from 'date-fns';

/** All quantity controls share cumulative daily surplus and reversible credits. */
export async function requestProgressChange(taskId: number, value: number, notes?: string | null): Promise<boolean> {
  const all = db.select().from(tasks).all();
  let task = all.find(t => t.id === taskId);
  if (!task || !Number.isFinite(value) || value < 0) throw new Error('Enter a valid non-negative progress amount.');
  if (task.planSummary) throw new Error('Log progress against the goal or its daily task.');
  const current = await getCurrentProgress(taskId);
  const owner = bankRoot(task, all); const today = getAppToday();
  const data = readPlanData(owner, today, db, all);
  const date = task.scope === 'daily' ? task.scheduledDate : today;
  const targetRate = data.creditRows.find(c => c.appDate === date)?.baseline ?? (task.scope === 'daily' ? task.totalProgress ?? data.baseline : data.baseline);
  const dailyAfter = (data.byDate[date] ?? 0) + value - current;
  const days = getDaysRemaining(rangeEnd(owner), parseISO(today));
  const surplus = !owner.occurrenceTarget && value > current ? getSurplusChoices(dailyAfter, data.done - (data.byDate[date] ?? 0), owner.totalProgress ?? 0, days, targetRate) : null;
  const reconcile = () => { reconcileQuantityPlans(today); advanceCoveredRepeats(today); reconcileQuantityPlans(today); };
  if (!surplus) { changeProgress(taskId, value, notes); reconcile(); return true; }
  const commit = (action: 'none' | 'breathing_room' | 'bank_it' | 'raise_bar') => { commitProgressAction(taskId, value, owner.id, action, { ...surplus, targetRate }, notes); reconcile(); };
  if (owner.surplusMode === 'breathing_room' || owner.surplusMode === 'bank_it') { commit(owner.surplusMode); return true; }
  return new Promise((resolve, reject) => {
    const save = (action: 'none' | 'breathing_room' | 'bank_it' | 'raise_bar') => { try { commit(action); resolve(true); } catch (error) { reject(error); } };
    const more = () => Alert.alert('Use extra progress', 'Bank covers future allocations or repeats of this task automatically. It does not cover unrelated tasks. Doing that work anyway moves the coverage forward. Actual progress is counted once.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: `Bank ${Number(surplus.surplusAmount.toFixed(2))} ${owner.progressUnit ?? 'units'}`, onPress: () => save('bank_it') },
      { text: `Raise target to ${surplus.suggestedNewTarget}`, onPress: () => save('raise_bar') },
    ], { cancelable: true, onDismiss: () => resolve(false) });
    Alert.alert('Ahead of pace', 'Keep the planned pace, reduce future targets, or bank the extra progress?', [
      { text: 'Keep pace', onPress: () => save('none') },
      { text: 'Ease future pace', onPress: () => save('breathing_room') },
      { text: 'More options', onPress: more },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function getSurplusPolicy(taskId: number) {
  const all = db.select().from(tasks).all(); const task = all.find(t => t.id === taskId);
  return task ? bankRoot(task, all) : null;
}
export function setSurplusPolicy(taskId: number, mode: 'none' | 'bank_it' | 'breathing_room') {
  const owner = getSurplusPolicy(taskId); if (!owner) throw new Error('This task no longer exists.');
  db.update(tasks).set({ surplusMode: mode }).where(eq(tasks.id, owner.id)).run();
  reconcileQuantityPlans(getAppToday());
}
