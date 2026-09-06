// src/app/(tabs)/month.tsx
import { GoalCard } from '@/components/GoalCard';
import NewMonthlyTaskModal from '@/components/NewMonthlyTaskModal';
import { deleteTask, getEffectiveProgress, getMonthlyTasks, getSubtaskCounts, getTasksForDateRange } from '@/db/queries';
import { useTaskStore } from '@/store/taskStore';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MonthScreen() {
  const insets = useSafeAreaInsets();
  const { setSelectedDate, loadTasks } = useTaskStore();
  const monthlyModalRef = useRef<BottomSheet>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthData, setMonthData] = useState<Record<string, { total: number; completed: number }>>({});
  const [monthlyTasks, setMonthlyTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDayStr, setSelectedDayStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedTaskToEdit, setSelectedTaskToEdit] = useState<any | null>(null);

  const [goalProgress, setGoalProgress] = useState<Record<number, number>>({});
  const [goalSubtasks, setGoalSubtasks] = useState<Record<number, { completed: number; total: number }>>({});

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const daysGrid = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  useEffect(() => {
    loadMonthData();
  }, [currentMonth]);

  const loadMonthData = async () => {
    setIsLoading(true);
    try {
      const startStr = format(calendarStart, 'yyyy-MM-dd');
      const endStr = format(calendarEnd, 'yyyy-MM-dd');
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

      const [tasksInRange, mTasks] = await Promise.all([
        getTasksForDateRange(startStr, endStr),
        getMonthlyTasks(monthStartStr, monthEndStr),
      ]);

      setMonthlyTasks(mTasks);

      const map: Record<string, { total: number; completed: number }> = {};
      for (const t of tasksInRange) {
        if (!map[t.scheduledDate]) map[t.scheduledDate] = { total: 0, completed: 0 };
        map[t.scheduledDate].total += 1;
        if (t.isCompleted) map[t.scheduledDate].completed += 1;
      }
      setMonthData(map);

      const progressionGoals = mTasks.filter((t) => t.type === 'Progression');
      const hybridGoals = mTasks.filter((t) => t.type === 'Hybrid');
      const [progressEntries, subtaskEntries] = await Promise.all([
        Promise.all(progressionGoals.map(async (t) => [t.id, await getEffectiveProgress(t.id)] as const)),
        Promise.all(hybridGoals.map(async (t) => [t.id, await getSubtaskCounts(t.id)] as const)),
      ]);
      setGoalProgress(Object.fromEntries(progressEntries));
      setGoalSubtasks(Object.fromEntries(subtaskEntries));
    } catch (error) {
      console.error('Failed to load month data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDayPress = (day: Date) => {
    setSelectedDayStr(format(day, 'yyyy-MM-dd'));
  };

  const toggleSelectTask = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleLongPressTask = (task: any) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([task.id]);
    }
  };

  const handleBatchDelete = () => {
    Alert.alert(
      'Delete Selected Goals',
      `Are you sure you want to delete ${selectedIds.length} selected goal(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              await deleteTask(id);
            }
            setSelectedIds([]);
            setSelectionMode(false);
            loadMonthData();
          },
        },
      ]
    );
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleSelectAllMonthly = () => {
  setSelectedIds(monthlyTasks.map((t) => t.id));
  };

  const handleEditSingleSelected = () => {
    if (selectedIds.length !== 1) return;
    const task = monthlyTasks.find((t) => t.id === selectedIds[0]);
    exitSelectionMode();
    if (task) {
      setSelectedTaskToEdit(task);
      monthlyModalRef.current?.expand();
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <View style={styles.outerContainer}>
      {selectionMode && (
      <View style={[styles.selectionHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={exitSelectionMode} hitSlop={10}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.selectionCountText}>{selectedIds.length} selected</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={handleSelectAllMonthly} hitSlop={8}>
            <Ionicons name="checkbox-outline" size={20} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEditSingleSelected} disabled={selectedIds.length !== 1} hitSlop={8}>
            <Ionicons name="pencil-outline" size={20} color={selectedIds.length === 1 ? colors.accent : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBatchDelete} disabled={selectedIds.length === 0} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color={colors.danger ?? '#ef4444'} />
          </TouchableOpacity>
        </View>
      </View>
    )}
      <ScrollView 
        style={[styles.container, { paddingTop: selectionMode ? 8 : insets.top }]} 
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekHeaderRow}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <Text key={d} style={styles.weekHeaderText}>{d}</Text>
          ))}
        </View>

        <View style={styles.gridContainer}>
          {daysGrid.map((day, index) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const stats = monthData[dayStr];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = dayStr === selectedDayStr;
            const isToday = isSameDay(day, new Date());

            let dotColor = 'transparent';
            if (stats && stats.total > 0) {
              if (stats.completed === stats.total) {
                dotColor = colors.success;
              } else if (stats.completed > 0) {
                dotColor = colors.priorityMediumBorder;
              } else {
                dotColor = colors.priorityHighBorder;
              }
            }

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  !isCurrentMonth && styles.outsideMonthCell,
                  isSelected && styles.selectedDayCell,
                  isToday && styles.todayCell,
                ]}
                onPress={() => handleDayPress(day)}
              >
                <Text style={[styles.dayText, !isCurrentMonth && styles.outsideMonthText]}>
                  {format(day, 'd')}
                </Text>
                <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.summaryHeader}>Monthly Goals & Tasks</Text>
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => {
                setSelectedTaskToEdit(null);
                monthlyModalRef.current?.expand();
              }}
            >
              <Text style={styles.addButtonText}>+ Add Monthly</Text>
            </TouchableOpacity>
          </View>

          {monthlyTasks.length === 0 ? (
            <Text style={styles.emptySummary}>No monthly-scope tasks set for this month.</Text>
          ) : (
            monthlyTasks.map((task) => (
              <GoalCard
                key={task.id}
                task={task}
                scopeLabel="month"
                effectiveProgress={goalProgress[task.id]}
                subtaskCounts={goalSubtasks[task.id]}
                selectionMode={selectionMode}
                isSelected={selectedIds.includes(task.id)}
                onPress={() => {
                  if (selectionMode) {
                    toggleSelectTask(task.id);
                  } else {
                    setSelectedTaskToEdit(task);
                    monthlyModalRef.current?.expand();
                  }
                }}
                onLongPress={() => handleLongPressTask(task)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <NewMonthlyTaskModal
        sheetRef={monthlyModalRef}
        monthStartDate={format(monthStart, 'yyyy-MM-dd')}
        monthEndDate={format(monthEnd, 'yyyy-MM-dd')}
        editTask={selectedTaskToEdit}
        onTaskCreated={loadMonthData}
        onClose={() => setSelectedTaskToEdit(null)}
      />
    </View>
    
  );
  
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  monthTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  navButton: { padding: 10, backgroundColor: colors.surface, borderRadius: 8 },
  navButtonText: { color: colors.accent, fontSize: 16, fontWeight: 'bold' },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekHeaderText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', width: '14%', textAlign: 'center' },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 8,
  },
  outsideMonthCell: { opacity: 0.3 },
  selectedDayCell: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accent },
  todayCell: { backgroundColor: colors.surfaceSubtle },
  dayText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  outsideMonthText: { color: colors.textMuted },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  summaryContainer: { marginTop: 24, backgroundColor: colors.surface, borderRadius: 12, padding: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryHeader: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  addButton: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  addButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  emptySummary: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectionCancelText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  selectionCountText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  selectionDeleteText: { color: colors.danger ?? '#ef4444', fontSize: 14, fontWeight: '700' },
});