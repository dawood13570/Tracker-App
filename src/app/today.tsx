// app/today.tsx
import BottomSheet from '@gorhom/bottom-sheet';
import { FlashList } from "@shopify/flash-list";
import { eq } from 'drizzle-orm';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import NewTaskModal, { getLocalDateString } from '../components/new-task';
import { Task, TaskCard } from '../components/TaskCard';
import { db } from '../db/client';
import { toggleTaskStatus } from '../db/queries';
import { tasks as tasksTable } from '../db/schema';



export function DateHeader() {
  const currentDate = new Date().toLocaleDateString('ur-US', {
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchActiveTasks() {
    try {
      const todayStr = getLocalDateString();

      const result = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.scheduledDate, todayStr))

      // console.log("Tasks currently stored inside the SQlite file:", result);
      setTasks(result as Task[]);
    } catch (err) {
      console.error("Failed to read tasks from local store file:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchActiveTasks();
  }, []);
  

  const handleToggleTask = async (id: number, currentStatus: boolean) => {
    try {
      await toggleTaskStatus(id, currentStatus);
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isCompleted: !currentStatus } : t))
      );
    } catch (err) {
      console.error("Failed to alter complete status:", err);
    }
  };


  const summary = useMemo(() => {
    return tasks.reduce((acc, task) => {
      acc.total++;
      acc.types[task.type] = (acc.types[task.type] || 0) + 1;
      acc.priorities[task.priority] = (acc.priorities[task.priority] || 0) + 1;
      if (task.isCompleted) acc.completed++; else acc.incomplete++;
      return acc;
    }, {
      total: 0, 
      types: {} as Record<string, number>, 
      priorities: {} as Record<string, number>, 
      completed: 0, 
      incomplete: 0
    });
  }, [tasks]);

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
              <Text style={{ color: "#c40000" }}>High: {summary.priorities['high'] || 0} </Text>| 
              Medium: {summary.priorities['medium'] || 0} | 
              Low: {summary.priorities['low'] || 0}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#1c8db9" style={{ marginTop: 40 }} />
          ) : (
            <FlashList
              data={tasks}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => <TaskCard task={item} onToggle={handleToggleTask} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Nothing to do today.</Text>
                  <Text style={styles.emptyStateSubtext}>Tap + to add task.</Text>
                </View>
              }
            />
          )}
        </View>

        <Pressable 
          onPress={() => taskSheetRef.current?.expand()} 
          style={({ pressed }) => [
            styles.buttonStuff, 
            { backgroundColor: pressed ? "#155b76" : "#1c8db9" }
          ]}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>

        {/* Wire parent data refresher directly to task modal completion listener hooks */}
        <NewTaskModal sheetRef={taskSheetRef} onTaskCreated={fetchActiveTasks} />
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
    paddingBottom: 100
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
});