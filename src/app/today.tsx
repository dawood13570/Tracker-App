// app/today.tsx

import { getEffectivePriority, shouldArchiveTask } from '@/engine/priority';
import BottomSheet from '@gorhom/bottom-sheet';
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StatusBar, StyleSheet, Text, View, } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import NewTaskModal from '../components/new-task';
import { Task, TaskCard } from '../components/TaskCard';
import { useTaskStore } from "../store/taskStore";
import { useStore } from '../store/useStore';
import { runRolloverNow } from '../tasks/rolloverTask';

const PRIORITY_WEIGHT: Record<string, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
}


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
  const flashListRef = useRef<FlashListRef<any>>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const insets = useSafeAreaInsets();

  const { tasks, isLoading, loadTasks, toggleTask, removeTask } = useTaskStore();
  const { evolvingPriorityEnabled } = useStore();

  useEffect(() => {
    const catchUpAndLoad = async () => {
      await runRolloverNow();
      await loadTasks();
    };

    catchUpAndLoad();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadTasks();
      }
    });

    return () => subscription.remove();
  }, []);

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    taskSheetRef.current?.expand();
  };

  const handleToggleTask = async (id: number) => {
    const wasTopTask = visibleTasks[0]?.id === id;

    await toggleTask(id);

    if (wasTopTask) {
      requestAnimationFrame(() => {
        flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
  }

  const handleDeleteTask = (id: number) => {
    removeTask(id);
  }

  const summary = useMemo(() => {
    return tasks.reduce((acc, task) => {
      acc.total++;
      acc.types[task.type] = (acc.types[task.type] || 0) + 1;
      const effectivePriority = evolvingPriorityEnabled
        ? getEffectivePriority({
            priority: task.priority,
            procrastinationCount: task.procrastinationCount ?? 0,
          })
        : task.priority;
      acc.priorities[effectivePriority] = (acc.priorities[effectivePriority] || 0) + 1;
      if (task.isCompleted) acc.completed++; else acc.incomplete++;
      return acc;
    }, {
      total: 0, 
      types: {} as Record<string, number>, 
      priorities: {} as Record<string, number>, 
      completed: 0, 
      incomplete: 0
    });
  }, [tasks, evolvingPriorityEnabled]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }

      const effectiveA = evolvingPriorityEnabled
        ? getEffectivePriority({ priority: a.priority, procrastinationCount: a.procrastinationCount ?? 0 })
        : a.priority;
      const effectiveB = evolvingPriorityEnabled
        ? getEffectivePriority({ priority: b.priority, procrastinationCount: b.procrastinationCount ?? 0 })
        : b.priority;

      const weightA = PRIORITY_WEIGHT[effectiveA] || 0;
      const weightB = PRIORITY_WEIGHT[effectiveB] || 0;

      return weightB - weightA;
    });
  }, [tasks, evolvingPriorityEnabled]);

  const { visibleTasks, archivedCount } = useMemo(() => {
    if (!evolvingPriorityEnabled) {
      return { visibleTasks: sortedTasks, archivedCount: 0 };
    }

    const archiveInputs = tasks.map((t) => ({
      id: t.id,
      priority: t.priority,
      procrastinationCount: t.procrastinationCount ?? 0,
    }));

    const visible = sortedTasks.filter((t) => {
      if (t.isCompleted) return true; // never archive already-completed tasks

      const input = { id: t.id, priority: t.priority, procrastinationCount: t.procrastinationCount ?? 0 };
      return !shouldArchiveTask(input, archiveInputs);
    });

    return {
      visibleTasks: visible,
      archivedCount: sortedTasks.length - visible.length,
    };
  }, [sortedTasks, tasks, evolvingPriorityEnabled]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        <View style={styles.stickyHeader}>
          <DateHeader/>

          

          <View style={styles.metricCard}>
            <Text style={{ fontWeight: "600", textAlign: "center", marginBottom: 4 }}>Task Metrics</Text>
            <Text style={styles.metricLine}>Total: {summary.total} | Completed:<Text style={{ color: "#40af69" }}> {summary.completed}</Text> | Pending: {summary.incomplete}</Text>
            <Text style={styles.metricLine}>Simple: {summary.types['Simple'] || 0} | Hybrid: {summary.types['Hybrid'] || 0} | Progression: {summary.types['Progression'] || 0}</Text>
            <Text style={styles.metricLine}>
              <Text style={{ color: "#c40000" }}>High: {summary.priorities['High'] || 0} </Text>| 
              Medium: {summary.priorities['Medium'] || 0} | 
              Low: {summary.priorities['Low'] || 0}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#1c8db9" style={{ marginTop: 40 }} />
          ) : (
            <>
              {archivedCount > 0 && (
                <View style={styles.archiveBanner}>
                  <Text style={styles.archiveBannerText}>
                    {archivedCount} task{archivedCount > 1 ? 's' : ''} archived until an overdue task is done
                  </Text>
                </View>
              )}
              <FlashList
                ref={flashListRef}
                extraData={visibleTasks}
                data={visibleTasks}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={[ styles.listContent, {paddingBottom: 20 + insets.bottom} ]}
                renderItem={({ item }) => <TaskCard task={item} onToggle={handleToggleTask} onDelete={handleDeleteTask} onEdit={handleEditTask}/>}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>Nothing to do today.</Text>
                    <Text style={styles.emptyStateSubtext}>Tap + to add task.</Text>
                  </View>
                }
              />
            </>
          )}
        </View>

                <Pressable 
                  onPress={() => {setEditingTask(null);
                                taskSheetRef.current?.expand();}}
                  style={({ pressed }) => [
                    styles.buttonStuff, 
                    { backgroundColor: pressed ? "#155b76" : "#1c8db9", bottom: 35 + insets.bottom }
                  ]}
                >
                  <Text style={styles.buttonText}>+</Text>
                </Pressable>

        <NewTaskModal sheetRef={taskSheetRef} onTaskCreated={() => loadTasks()} taskToEdit={editingTask} onClose={() => setEditingTask(null)} />
      </SafeAreaView> 
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  dateHeaderText: {
    fontSize: 22,
    color: '#1A1A1A',
    fontWeight: '800',
    paddingLeft: 25,
    paddingTop: 20
  },
  stickyHeader:{
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#EAEAEA',
    elevation: 2,
  },
  metricCard: { 
    paddingHorizontal: 20, 
    marginHorizontal: 25, 
    marginVertical: 20, 
    backgroundColor: "#ededed", 
    borderRadius: 12, 
    paddingVertical: 12, 
    elevation: 2 
  },
  metricLine: {
    fontSize: 13,
    color: '#333',
    marginVertical: 1,
    textAlign: 'center'
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  buttonStuff:{
    width: 65,
    height: 65,
    position: "absolute",
    bottom: 35,
    right: 25,
    justifyContent: "center",
    alignItems: "center", 
    borderRadius: 32.5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  buttonText:{
    color: "#ffffff",
    fontSize: 32,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: -4
  },
  emptyState: {
  marginTop: 60,
  alignItems: 'center',
  paddingHorizontal: 32,
},
emptyStateText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#444',
},
emptyStateSubtext: {
  fontSize: 14,
  color: '#888',
  marginTop: 6,
  textAlign: 'center',
},
archiveBanner: {
  marginHorizontal: 20,
  marginBottom: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
  backgroundColor: '#fef2f2',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#fca5a5',
},
archiveBannerText: {
  fontSize: 12,
  color: '#991b1b',
  textAlign: 'center',
},
});