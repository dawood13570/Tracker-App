// src/app/custom-goals.tsx
import { GoalCard } from '@/components/GoalCard';
import { PeriodGoalModal } from '@/components/PeriodGoalModal';
import {
    deleteTaskCascade,
    getAllCustomGoals,
    getCompletedOccurrenceCount,
    getEffectiveProgress,
    getSubtaskCounts,
    TaskRow,
} from '@/db/queries';
import { colors } from '@/theme/colors';
import { getLocalDateString } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { addDays, format } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomGoalsScreen() {
  const insets = useSafeAreaInsets();
  const modalRef = useRef<BottomSheet>(null);

  const [goals, setGoals] = useState<TaskRow[]>([]);
  const [goalProgress, setGoalProgress] = useState<Record<number, number>>({});
  const [goalSubtasks, setGoalSubtasks] = useState<Record<number, { completed: number; total: number }>>({});
  const [goalOccurrences, setGoalOccurrences] = useState<Record<number, number>>({});
  const [editingGoal, setEditingGoal] = useState<TaskRow | null>(null);

  const loadGoals = useCallback(async () => {
    const list = await getAllCustomGoals();
    setGoals(list);

    const progressionGoals = list.filter((t) => t.type === 'Progression');
    const hybridGoals = list.filter((t) => t.type === 'Hybrid');
    const countGoals = list.filter((t) => t.occurrenceTarget != null && t.occurrenceTarget > 0);

    const [progressEntries, subtaskEntries, countEntries] = await Promise.all([
      Promise.all(progressionGoals.map(async (t) => [t.id, await getEffectiveProgress(t.id)] as const)),
      Promise.all(hybridGoals.map(async (t) => [t.id, await getSubtaskCounts(t.id)] as const)),
      Promise.all(countGoals.map(async (t) => [t.id, await getCompletedOccurrenceCount(t.id)] as const)),
    ]);

    setGoalProgress(Object.fromEntries(progressEntries));
    setGoalSubtasks(Object.fromEntries(subtaskEntries));
    setGoalOccurrences(Object.fromEntries(countEntries));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGoals();
    }, [loadGoals])
  );

  const handleDelete = (goal: TaskRow) => {
    Alert.alert('Delete Goal', `Delete "${goal.title}"? This removes its generated daily tasks too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTaskCascade(goal.id);
          await loadGoals();
        },
      },
    ]);
  };

  const defaultStart = getLocalDateString(new Date());
  const defaultEnd = getLocalDateString(addDays(new Date(), 30));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Custom Goals</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditingGoal(null);
              modalRef.current?.expand();
            }}
          >
            <Ionicons name="add" size={20} color={colors.textOnAccent} />
          </TouchableOpacity>
        </View>

        <Text style={styles.hintText}>
          Goals with a start and end date of your own choosing — not tied to a week, month, or year.
        </Text>

        <ScrollView contentContainerStyle={styles.listContent}>
          {goals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-number-outline" size={28} color={colors.textMuted} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>No custom-range goals yet.</Text>
            </View>
          ) : (
            goals.map((goal) => (
              <View key={goal.id} style={styles.goalRow}>
                <GoalCard
                  task={goal}
                  scopeLabel="custom"
                  effectiveProgress={goalProgress[goal.id]}
                  completedOccurrences={goalOccurrences[goal.id]}
                  subtaskCounts={goalSubtasks[goal.id]}
                  onPress={() => {
                    setEditingGoal(goal);
                    modalRef.current?.expand();
                  }}
                  onLongPress={() => handleDelete(goal)}
                />
                <Text style={styles.rangeText}>
                  {format(new Date(`${goal.scheduledDate}T00:00:00`), 'MMM d, yyyy')} –{' '}
                  {goal.deadline ? format(new Date(`${goal.deadline}T00:00:00`), 'MMM d, yyyy') : '—'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        <PeriodGoalModal
          sheetRef={modalRef}
          scope="custom"
          startDate={defaultStart}
          endDate={defaultEnd}
          editTask={editingGoal}
          onTaskCreated={loadGoals}
          onClose={() => setEditingGoal(null)}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  addBtn: { backgroundColor: colors.accent, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  hintText: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 16, marginBottom: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { fontSize: 13, color: colors.textMuted },
  goalRow: { marginBottom: 4 },
  rangeText: { fontSize: 11, color: colors.textMuted, marginTop: -6, marginBottom: 10, marginLeft: 4 },
});