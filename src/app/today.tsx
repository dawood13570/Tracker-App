// app/today.tsx
import NewHabitModal from '@/components/NewHabitModal';
import { calculatePace, PaceResult } from '@/engine/pace';
import { getEffectivePriority, shouldArchiveTask } from '@/engine/priority';
import BottomSheet from '@gorhom/bottom-sheet';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HabitCard } from '../components/HabitCard';
import NewTaskModal from '../components/new-task';
import ProgressLogSheet from '../components/ProgressLogSheet';
import { TaskCard } from '../components/TaskCard';
import { getCurrentProgress, getProgressLogsByTask, getSubtaskCounts } from '../db/queries';
import { HabitWithStatus, useHabitStore } from '../store/habitStore';
import { Task, useTaskStore } from '../store/taskStore';
import { useStore } from '../store/useStore';
import { runRolloverNow } from '../tasks/rolloverTask';
import { colors } from '../theme/colors';

const PRIORITY_WEIGHT: Record<string, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export function DateHeader() {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View>
      <Text style={styles.dateHeaderText}>{currentDate}</Text>
    </View>
  );
}

export default function AppDashboard() {
  const taskSheetRef = useRef<BottomSheet>(null);
  const progressSheetRef = useRef<BottomSheet>(null);
  const flashListRef = useRef<FlashListRef<any>>(null);
  const habitSheetRef = useRef<BottomSheet>(null);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loggingTask, setLoggingTask] = useState<Task | null>(null);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [paceMap, setPaceMap] = useState<Record<number, PaceResult>>({});
  const [subtaskMap, setSubtaskMap] = useState<Record<number, { completed: number; total: number }>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({});
  const [editingHabit, setEditingHabit] = useState<HabitWithStatus | null>(null);

  const insets = useSafeAreaInsets();

  const { tasks, isLoading, loadTasks, toggleTask, removeTask } = useTaskStore();
  const { evolvingPriorityEnabled, autoArchiveEnabled } = useStore();
  const { habits, loadHabits, logHabit, removeHabit, updateHabit } = useHabitStore();


     const handleEditHabit = (habit: HabitWithStatus) => {
    setEditingHabit(habit);
    habitSheetRef.current?.expand();
    };

    const handleDeleteHabit = (id: number) => {
      removeHabit(id);
    };

  useEffect(() => {
    const catchUpAndLoad = async () => {
      await runRolloverNow();
      await loadTasks();
      await loadHabits();
    };

    catchUpAndLoad();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadTasks();
        loadHabits();
      }
    });

    return () => subscription.remove();
  }, []);

  // Progression metrics calculation
  useEffect(() => {
    const progressionTasks = tasks.filter((t) => t.type === 'Progression');
    if (progressionTasks.length === 0) {
      setProgressMap({});
      setPaceMap({});
      return;
    }

    Promise.all(
      progressionTasks.map(async (t) => {
        const [currentProgress, logs] = await Promise.all([
          getCurrentProgress(t.id),
          getProgressLogsByTask(t.id),
        ]);

        const pace = calculatePace({ ...t, currentProgress }, logs);
        return [t.id, currentProgress, pace] as const;
      })
    ).then((entries) => {
      setProgressMap(Object.fromEntries(entries.map(([id, cp]) => [id, cp])));
      setPaceMap(Object.fromEntries(entries.map(([id, , pace]) => [id, pace])));
    });
  }, [tasks]);

  // Hybrid live subtask counts
  useEffect(() => {
    const hybridTasks = tasks.filter((t) => t.type === 'Hybrid');
    if (hybridTasks.length === 0) {
      setSubtaskMap({});
      return;
    }

    Promise.all(
      hybridTasks.map(async (t) => {
        const counts = await getSubtaskCounts(t.id);
        return [t.id, counts] as const;
      })
    ).then((entries) => {
      setSubtaskMap(Object.fromEntries(entries));
    });
  }, [tasks]);

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    taskSheetRef.current?.expand();
  };

  const handleOpenProgressLog = (task: Task) => {
    setLoggingTask(task);
    progressSheetRef.current?.expand();
  };

  const handleToggleExpand = (taskId: number) => {
    setExpandedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Removed the jumpy scrollToOffset call
  const handleToggleTask = async (id: number) => {
    await toggleTask(id);
  };

  const handleDeleteTask = (id: number) => {
    removeTask(id);
  };

  // Instant local update for hybrid counts (prevents list reloading)
  const handleSubtasksCountUpdate = (taskId: number, completed: number, total: number) => {
    setSubtaskMap((prev) => ({
      ...prev,
      [taskId]: { completed, total },
    }));
  };

  const summary = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        acc.total++;
        acc.types[task.type] = (acc.types[task.type] || 0) + 1;
        const effectivePriority = evolvingPriorityEnabled
          ? getEffectivePriority({
              priority: task.priority,
              procrastinationCount: task.procrastinationCount ?? 0,
            })
          : task.priority;
        acc.priorities[effectivePriority] = (acc.priorities[effectivePriority] || 0) + 1;
        if (task.isCompleted) acc.completed++;
        else acc.incomplete++;
        return acc;
      },
      {
        total: 0,
        types: {} as Record<string, number>,
        priorities: {} as Record<string, number>,
        completed: 0,
        incomplete: 0,
      }
    );
  }, [tasks, evolvingPriorityEnabled]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }

      const effectiveA = evolvingPriorityEnabled
        ? getEffectivePriority({
            priority: a.priority,
            procrastinationCount: a.procrastinationCount ?? 0,
          })
        : a.priority;
      const effectiveB = evolvingPriorityEnabled
        ? getEffectivePriority({
            priority: b.priority,
            procrastinationCount: b.procrastinationCount ?? 0,
          })
        : b.priority;

      const weightA = PRIORITY_WEIGHT[effectiveA] || 0;
      const weightB = PRIORITY_WEIGHT[effectiveB] || 0;

      return weightB - weightA;
    });
  }, [tasks, evolvingPriorityEnabled]);

  const { visibleTasks, archivedCount } = useMemo(() => {
    if (!autoArchiveEnabled) {
      return { visibleTasks: sortedTasks, archivedCount: 0 };
    }

    const archiveInputs = tasks.map((t) => ({
      id: t.id,
      priority: t.priority,
      procrastinationCount: t.procrastinationCount ?? 0,
    }));

    const visible = sortedTasks.filter((t) => {
      if (t.isCompleted) return true;

      const input = {
        id: t.id,
        priority: t.priority,
        procrastinationCount: t.procrastinationCount ?? 0,
      };
      return !shouldArchiveTask(input, archiveInputs);
    });

    return {
      visibleTasks: visible,
      archivedCount: sortedTasks.length - visible.length,
    };
  }, [sortedTasks, tasks, autoArchiveEnabled]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

        <View style={styles.stickyHeader}>
          <DateHeader />

          {/* <View style={styles.metricCard}>
            <Text style={{ fontWeight: '600', textAlign: 'center', marginBottom: 4, color: '#ffffff' }}>
              Task Metrics
            </Text>
            <Text style={styles.metricLine}>
              Total: {summary.total} | Completed:
              <Text style={{ color: colors.success }}> {summary.completed}</Text> | Pending:{' '}
              {summary.incomplete}
            </Text>
            <Text style={styles.metricLine}>
              Simple: {summary.types['Simple'] || 0} | Hybrid: {summary.types['Hybrid'] || 0} |
              Progression: {summary.types['Progression'] || 0}
            </Text>
            <Text style={styles.metricLine}>
              <Text style={{ color: colors.danger }}>High: {summary.priorities['High'] || 0} </Text>|
              Medium: {summary.priorities['Medium'] || 0} | Low: {summary.priorities['Low'] || 0}
            </Text>
          </View> */}
        </View>

        <View style={{ flex: 1 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#1c8db9" style={{ marginTop: 40 }} />
          ) : (
            <>
              {archivedCount > 0 && (
                <View style={styles.archiveBanner}>
                  <Text style={styles.archiveBannerText}>
                    {archivedCount} task{archivedCount > 1 ? 's' : ''} archived until an overdue
                    task is done
                  </Text>
                </View>
              )}
              <FlashList
                ref={flashListRef}
                extraData={{ visibleTasks, expandedTaskIds, subtaskMap }}
                data={visibleTasks}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: 20 + insets.bottom },
                ]}
                renderItem={({ item }) => (
                  <TaskCard
                    task={item}
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                    onEdit={handleEditTask}
                    currentProgress={progressMap[item.id]}
                    pace={paceMap[item.id]}
                    subtaskCount={subtaskMap[item.id]}
                    isExpanded={Boolean(expandedTaskIds[item.id])}
                    onToggleExpand={() => handleToggleExpand(item.id)}
                    onOpenProgressLog={handleOpenProgressLog}
                    onSubtasksCountUpdate={handleSubtasksCountUpdate}
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>Nothing to do today.</Text>
                    <Text style={styles.emptyStateSubtext}>Tap + to add task.</Text>
                  </View>
                }
                ListHeaderComponent={
                  habits.length > 0 ? (
                    <View style={{ marginBottom: 8}}>
                      {habits.map((habit) => (
                        <HabitCard key={habit.id} habit={habit} onLogToday={logHabit} onEdit={handleEditHabit} onDelete={handleDeleteHabit}/>
                      ))}
                    </View>
                  ) : null
                }
              />
            </>
          )}
        </View>

        <Pressable
          onPress={() => {
            setEditingTask(null);
            taskSheetRef.current?.expand();
          }}
          style={({ pressed }) => [
            styles.buttonStuff,
            {
              backgroundColor: pressed ? '#155b76' : '#1c8db9',
              bottom: 35 + insets.bottom,
            },
          ]}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>

        <Pressable
          onPress={() => {setEditingHabit(null); habitSheetRef.current?.expand()}}
          style={({ pressed }) => [
            styles.habitButtonStuff,
            {
              backgroundColor: pressed ? colors.habitAccentPressed : colors.habitAccent,
              bottom: 110 + insets.bottom,
            },
          ]}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>

        <NewHabitModal
          sheetRef={habitSheetRef}
          onHabitCreated={() => loadHabits()}
          habitToEdit={editingHabit}
          onClose={()=> setEditingHabit(null)}
        />

        <NewTaskModal
          sheetRef={taskSheetRef}
          onTaskCreated={() => loadTasks()}
          taskToEdit={editingTask}
          onClose={() => setEditingTask(null)}
        />

        <ProgressLogSheet
          sheetRef={progressSheetRef}
          task={loggingTask}
          currentProgress={loggingTask ? progressMap[loggingTask.id] ?? 0 : 0}
          pace={loggingTask ? paceMap[loggingTask.id] : undefined}
          onLogged={() => loadTasks()}
          onClose={() => setLoggingTask(null)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  dateHeaderText: { fontSize: 22, color: colors.textPrimary, fontWeight: '800', paddingLeft: 25, paddingTop: 20 },
  stickyHeader: { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, elevation: 2, paddingBottom: 25 },
  metricCard: { paddingHorizontal: 20, marginHorizontal: 25, marginVertical: 20, backgroundColor: colors.surfaceElevated, borderRadius: 12, paddingVertical: 12, elevation: 2 },
  metricLine: { fontSize: 13, color: colors.textSecondary, marginVertical: 1, textAlign: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 16 },
  buttonStuff: { width: 65, height: 65, position: 'absolute', bottom: 35, right: 25, justifyContent: 'center', alignItems: 'center', borderRadius: 32.5, elevation: 5, shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3 },
  buttonText: { color: colors.textOnAccent, fontSize: 32, fontWeight: '300', textAlign: 'center', marginTop: -4 },
  emptyState: { marginTop: 60, alignItems: 'center', paddingHorizontal: 32 },
  emptyStateText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptyStateSubtext: { fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
  archiveBanner: { marginHorizontal: 20, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.dangerBg, borderRadius: 8, borderWidth: 1, borderColor: colors.dangerBorder },
  archiveBannerText: { fontSize: 12, color: colors.danger, textAlign: 'center' },
  habitButtonStuff: { position: 'absolute', width: 50, height: 50, borderRadius: 25, bottom: 110, right: 30, justifyContent: 'center' },
});