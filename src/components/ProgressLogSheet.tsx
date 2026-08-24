// src/components/ProgressLogSheet.tsx

import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { getProgressLogsByTask, insertProgressLog } from '../db/queries';
import { getSurplusChoices, PaceResult, SurplusOptions } from '../engine/pace';
import { Task, useTaskStore } from '../store/taskStore';

interface ProgressLog {
  id: number;
  amount: number;
  loggedAt: string;
  notes: string | null;
}

interface ProgressLogSheetProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  task: Task | null;
  currentProgress: number;
  onLogged: () => void;
  onClose?: () => void;
  pace?: PaceResult;
}

export default function ProgressLogSheet({
  sheetRef,
  task,
  currentProgress,
  onLogged,
  onClose,
  pace,
}: ProgressLogSheetProps) {
  const { completeTask, updateTask } = useTaskStore();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<ProgressLog[]>([]);
  
  // Surplus selection state
  const [saveDecision, setSaveDecision] = useState(false);
  const [pendingSurplus, setPendingSurplus] = useState<{
    options: SurplusOptions;
    parsedAmount: number;
  } | null>(null);

  const snapPoints = useMemo(() => ['75%', '45%'], []);

  useEffect(() => {
    if (task) {
      getProgressLogsByTask(task.id).then(setHistory);
    } else {
      setHistory([]);
    }
    setPendingSurplus(null);
    setSaveDecision(false);
  }, [task]);

  const resetForm = () => {
    setAmount('');
    setNote('');
    setPendingSurplus(null);
    setSaveDecision(false);
  };

  if (!task) {
    return (
      <BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose>
        <View />
      </BottomSheet>
    );
  }

  const remaining =
    task.totalProgress != null ? Math.max(task.totalProgress - currentProgress, 0) : null;

  const handleCommitLog = async (
    action: 'breathing_room' | 'bank_it' | 'raise_bar' | 'none',
    customNewTarget?: number,
    earnedBufferDays?: number
  ) => {
    const parsed = pendingSurplus ? pendingSurplus.parsedAmount : Number(amount);

    try {
      await insertProgressLog({
        taskId: task.id,
        amount: parsed,
        notes: note.trim() || null,
      });

      const newTotal = currentProgress + parsed;
      const updates: any = {};

      if (action === 'bank_it' && earnedBufferDays) {
        updates.bufferDays = (task.bufferDays ?? 0) + earnedBufferDays;
      } else if (action === 'raise_bar' && customNewTarget) {
        updates.totalProgress = customNewTarget;
      }

      // If user opted to save their choice, persist surplusMode to the task
      if (saveDecision) {
        updates.surplusMode = action;
      }

      if (Object.keys(updates).length > 0) {
        await updateTask(task.id, updates);
      }

      const effectiveTarget = updates.totalProgress ?? task.totalProgress;
      if (!task.isCompleted && effectiveTarget != null && newTotal >= effectiveTarget) {
        await completeTask(task.id);
      }

      resetForm();
      onLogged();
      sheetRef.current?.close();
    } catch (err) {
      console.error('Failed to log progress:', err);
    }
  };

  const handleInitialSubmit = () => {
    Keyboard.dismiss();
    const parsed = Number(amount);
    if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Amount required', 'Enter a positive number to log.');
      return;
    }

    const targetRate = pace?.target_rate ?? 0;
    const daysRemaining = pace?.days_remaining ?? 1;
    const total = task.totalProgress ?? 0;

    const surplusChoices = getSurplusChoices(parsed, currentProgress, total, daysRemaining, targetRate);

    // If surplus detected and not completed
    if (surplusChoices && total > currentProgress + parsed) {
      // Check if user already locked in a saved decision
      if (task.surplusMode === 'none') {
        handleCommitLog('none');
      } else if (task.surplusMode === 'bank_it') {
        handleCommitLog('bank_it', undefined, surplusChoices.bankedDaysEarned);
      } else if (task.surplusMode === 'raise_bar') {
        handleCommitLog('raise_bar', surplusChoices.suggestedNewTarget);
      } else if (task.surplusMode === 'breathing_room') {
        handleCommitLog('breathing_room');
      } else {
        // No saved choice -> ask every time
        setPendingSurplus({ options: surplusChoices, parsedAmount: parsed });
      }
    } else {
      handleCommitLog('none');
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: '#dedede' }}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      onClose={() => {
        resetForm();
        if (onClose) onClose();
      }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.titleText}>{task.title}</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLine}>
            {currentProgress} / {task.totalProgress ?? '—'} {task.progressUnit ?? ''}
          </Text>
          {remaining !== null && (
            <Text style={styles.summarySubline}>
              {remaining} {task.progressUnit ?? ''} remaining
            </Text>
          )}
          {task.deadline && <Text style={styles.summarySubline}>Deadline: {task.deadline}</Text>}
          {pace && (
            <Text style={styles.summarySubline}>
              Need {pace.target_rate} {task.progressUnit ?? ''}/day · Averaging {pace.actual_rate} · {pace.status}
            </Text>
          )}
        </View>

        {pendingSurplus ? (
          /* Contextual Post-Log Choice View */
          <View style={styles.surplusContainer}>
            <Text style={styles.surplusHeading}>
              Surplus Logged (+{pendingSurplus.options.surplusAmount} {task.progressUnit ?? ''})
            </Text>
            <Text style={styles.surplusSubtext}>How would you like to allocate this extra progress?</Text>

            <TouchableOpacity
              style={styles.surplusOptionBtn}
              onPress={() => handleCommitLog('breathing_room')}
            >
              <Text style={styles.surplusBtnTitle}>🧘 Ease Future Pace</Text>
              <Text style={styles.surplusBtnDesc}>
                Lowers daily target to {pendingSurplus.options.newDailyPace} {task.progressUnit ?? ''}/day
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.surplusOptionBtn}
              onPress={() => handleCommitLog('bank_it', undefined, pendingSurplus.options.bankedDaysEarned)}
            >
              <Text style={styles.surplusBtnTitle}>🏦 Bank Buffer</Text>
              <Text style={styles.surplusBtnDesc}>
                Bank +{pendingSurplus.options.bankedDaysEarned} day
                {pendingSurplus.options.bankedDaysEarned > 1 ? 's' : ''} of rest
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.surplusOptionBtn}
              onPress={() => handleCommitLog('raise_bar', pendingSurplus.options.suggestedNewTarget)}
            >
              <Text style={styles.surplusBtnTitle}>🚀 Stretch Goal</Text>
              <Text style={styles.surplusBtnDesc}>
                Raise total goal to {pendingSurplus.options.suggestedNewTarget} {task.progressUnit ?? ''}
              </Text>
            </TouchableOpacity>

            {/* Remember Choice Toggle */}
            <View style={styles.saveChoiceRow}>
              <Text style={styles.saveChoiceLabel}>Remember my choice for this task</Text>
              <Switch value={saveDecision} onValueChange={setSaveDecision} />
            </View>

            <TouchableOpacity style={styles.surplusSkipBtn} onPress={() => handleCommitLog('none')}>
              <Text style={styles.surplusSkipText}>Just log normally without changing pace</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Standard Input Form */
          <>
            <Text style={styles.label}>Log today's amount</Text>
            <BottomSheetTextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder={`e.g., 22 ${task.progressUnit ?? ''}`}
              placeholderTextColor="#999"
              keyboardType="numeric"
            />

            <BottomSheetTextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Note (optional)"
              placeholderTextColor="#999"
            />

            <Pressable
              disabled={!amount.trim() || Number(amount) <= 0}
              onPress={handleInitialSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                (!amount.trim() || Number(amount) <= 0) && styles.submitButtonDisabled,
                pressed ? { opacity: 0.85 } : null,
              ]}
            >
              <Text style={styles.submitButtonText}>Log Progress</Text>
            </Pressable>
          </>
        )}

        <Text style={styles.subSectionTitle}>History</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyHistoryText}>No entries yet.</Text>
        ) : (
          history.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={styles.historyAmount}>
                +{entry.amount} {task.progressUnit ?? ''}
              </Text>
              <Text style={styles.historyDate}>{entry.loggedAt.split('T')[0]}</Text>
              {entry.notes ? <Text style={styles.historyNote}>{entry.notes}</Text> : null}
            </View>
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#ececec',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbdbdb',
    padding: 12,
    marginBottom: 16,
  },
  summaryLine: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#222',
  },
  summarySubline: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#222',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#0070f3',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#d0d0d0',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: '#888',
  },
  historyRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
    paddingVertical: 8,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyDate: {
    fontSize: 12,
    color: '#888',
  },
  historyNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  surplusContainer: {
    marginTop: 6,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d6d6d6',
    marginBottom: 20,
  },
  surplusHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  surplusSubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  surplusOptionBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  surplusBtnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  surplusBtnDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  saveChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginVertical: 6,
  },
  saveChoiceLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  surplusSkipBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  surplusSkipText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
});