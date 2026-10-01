import { Alert } from 'react-native';
import { getTaskById, getCurrentProgress, getEffectiveProgress } from '../db/queries';
import { changeProgress, commitProgressAction } from '../db/lifecycle';
import { getSurplusChoices, getDaysRemaining } from '../engine/pace';
import { getAppToday } from '../utils/date';
import { parseISO } from 'date-fns';

/** Both the slider and logging sheet use this path. Cancel never writes. */
export async function requestProgressChange(taskId: number, value: number, notes?: string | null): Promise<boolean> {
  const task = await getTaskById(taskId);
  if (!task || !Number.isFinite(value) || value < 0) throw new Error('Enter a valid non-negative progress amount.');
  const current = await getCurrentProgress(taskId);
  let owner = task;
  const visited = new Set([owner.id]);
  while (owner.sourceTaskId != null) {
    const parent = await getTaskById(owner.sourceTaskId);
    if (!parent || visited.has(parent.id) || !(parent.totalProgress && parent.totalProgress > 0)) break;
    visited.add(parent.id); owner = parent;
  }
  const total = owner.totalProgress ?? 0;
  const done = await getEffectiveProgress(owner.id);
  const days = owner.deadline ? getDaysRemaining(owner.deadline, parseISO(getAppToday())) : 0;
  const targetRate = owner.nominalDailyTarget ?? (days > 0 ? (total - done) / days : 0);
  const surplus = days > 1 && value > current && done + value - current < total
    ? getSurplusChoices(value - current, done, total, days, targetRate) : null;
  if (!surplus) { changeProgress(taskId, value, notes); return true; }
  const commit = (action: 'none' | 'breathing_room' | 'bank_it' | 'raise_bar') => commitProgressAction(taskId, value, owner.id, action, { ...surplus, targetRate }, notes);
  // Raising a goal is always a deliberate choice, even if an older saved mode requested it.
  if (owner.surplusMode === 'breathing_room' || owner.surplusMode === 'bank_it') { commit(owner.surplusMode); return true; }
  return new Promise((resolve, reject) => {
    const save = (action: 'none' | 'breathing_room' | 'bank_it' | 'raise_bar') => { try { commit(action); resolve(true); } catch (error) { reject(error); } };
    const more = () => Alert.alert('Use extra progress', 'Banked days can be used as rest days from the goal or task card.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: `Bank ${surplus.bankedDaysEarned} day(s)`, onPress: () => save('bank_it') },
      { text: `Raise target to ${surplus.suggestedNewTarget}`, onPress: () => save('raise_bar') },
    ], { cancelable: true, onDismiss: () => resolve(false) });
    Alert.alert('Ahead of pace', 'Keep the planned pace, reduce future targets, or use the extra progress?', [
      { text: 'Keep pace', onPress: () => save('none') },
      { text: 'Ease future pace', onPress: () => save('breathing_room') },
      { text: 'More options', onPress: more },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
