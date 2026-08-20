// src/components/ProgressLogSheet.tsx

import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { getProgressLogsByTask, insertProgressLog } from '../db/queries';
import type { PaceResult } from '../engine/pace';
import { useTaskStore } from '../store/taskStore';
import { Task } from './TaskCard';
 
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
 
export default function ProgressLogSheet({ sheetRef, task, currentProgress, onLogged, onClose, pace }: ProgressLogSheetProps) {
  const { completeTask } = useTaskStore();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<ProgressLog[]>([]);
 
  const snapPoints = useMemo(() => ['70%', '40%'], []);
 
  // Load log history whenever a new task is opened for logging
  useEffect(() => {
    if (task) {
      getProgressLogsByTask(task.id).then(setHistory);
    } else {
      setHistory([]);
    }
  }, [task]);
 
  const resetForm = () => {
    setAmount('');
    setNote('');
  };
 
  if (!task) {
    return (
      <BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose>
        <View />
      </BottomSheet>
    );
  }
 
  const remaining = task.totalProgress != null
    ? Math.max(task.totalProgress - currentProgress, 0)
    : null;
 
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
            <Text style={styles.summarySubline}>{remaining} {task.progressUnit ?? ''} remaining</Text>
          )}
          {task.deadline && (
            <Text style={styles.summarySubline}>Deadline: {task.deadline}</Text>
          )}
          {pace && (
            <Text style={styles.summarySubline}>
              Need {pace.target_rate} {task.progressUnit ?? ''}/day · Averaging {pace.actual_rate} · {pace.status}
            </Text>
          )}
        </View>
 
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
          onPress={async () => {
            Keyboard.dismiss();
            const parsed = Number(amount);
            if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
              Alert.alert('Amount required', 'Enter a positive number to log.');
              return;
            }
            try {
              await insertProgressLog({
                taskId: task.id,
                amount: parsed,
                notes: note.trim() || null,
              });

              const newTotal = currentProgress + parsed;
              if (!task.isCompleted && task.totalProgress != null && newTotal >= task.totalProgress) {
                await completeTask(task.id);
              }

              resetForm();
              onLogged();
              sheetRef.current?.close();
            } catch (err) {
              console.error('Failed to log progress:', err);
            }
          }}
          style={({ pressed }) => [
            styles.submitButton,
            (!amount.trim() || Number(amount) <= 0) && styles.submitButtonDisabled,
            pressed ? { opacity: 0.85 } : null,
          ]}
        >
          <Text style={styles.submitButtonText}>Log Progress</Text>
        </Pressable>
 
        <Text style={styles.subSectionTitle}>History</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyHistoryText}>No entries yet.</Text>
        ) : (
          history.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={styles.historyAmount}>+{entry.amount} {task.progressUnit ?? ''}</Text>
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
});