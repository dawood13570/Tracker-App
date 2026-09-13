// src/app/(tabs)/year.tsx
import { GoalCard } from '@/components/GoalCard';
import NewYearlyTaskModal from '@/components/NewYearlyTaskModal';
import NoteSheet from '@/components/NoteSheet';
import {
  deleteTaskCascade,
  ensureDailyDecompositionForDate,
  getCompletedOccurrenceCount,
  getEffectiveProgress,
  getSubtaskCounts,
  getTasksForDateRange,
  getYearlyTasks,
} from '@/db/queries';
import { generatePeriodSeed } from '@/engine/notesSeed';
import { colors } from '@/theme/colors';
import { isPeriodEligibleForReflection } from '@/utils/reflections';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import {
  addYears,
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  format,
  isSameMonth,
  startOfMonth,
  startOfYear,
  subYears,
} from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function YearScreen() {
  const insets = useSafeAreaInsets();
  const yearlyModalRef = useRef<BottomSheet>(null);
  const noteSheetRef = useRef<BottomSheet>(null);

  const [currentYear, setCurrentYear] = useState(new Date());
  const [monthData, setMonthData] = useState<Record<string, { total: number; completed: number }>>({});
  const [yearlyTasks, setYearlyTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [monthSummary, setMonthSummary] = useState<any[]>([]);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedTaskToEdit, setSelectedTaskToEdit] = useState<any | null>(null);

  const [goalProgress, setGoalProgress] = useState<Record<number, number>>({});
  const [goalSubtasks, setGoalSubtasks] = useState<Record<number, { completed: number; total: number }>>({});
  const [goalOccurrences, setGoalOccurrences] = useState<Record<number, number>>({});

  const yearStart = startOfYear(currentYear);
  const yearEnd = endOfYear(currentYear);
  const monthsGrid = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  // Only allow end-of-year reflections once today is on or past the year's end date
  const isYearEligible = useMemo(() => isPeriodEligibleForReflection(yearEnd), [yearEnd]);

  const yearStartStr = useMemo(() => format(yearStart, 'yyyy-MM-dd'), [yearStart]);
  const yearEndStr = useMemo(() => format(yearEnd, 'yyyy-MM-dd'), [yearEnd]);

  const loadYearData = useCallback(async () => {
    setIsLoading(true);
    try {
      await ensureDailyDecompositionForDate(format(new Date(), 'yyyy-MM-dd'));

      const [tasksInRange, yTasks] = await Promise.all([
        getTasksForDateRange(yearStartStr, yearEndStr),
        getYearlyTasks(yearStartStr, yearEndStr),
      ]);

      setYearlyTasks(yTasks);

      const map: Record<string, { total: number; completed: number }> = {};
      for (const t of tasksInRange) {
        const monthKey = t.scheduledDate.slice(0, 7); // 'yyyy-MM'
        if (!map[monthKey]) map[monthKey] = { total: 0, completed: 0 };
        map[monthKey].total += 1;
        if (t.isCompleted) map[monthKey].completed += 1;
      }
      setMonthData(map);

      const progressionGoals = yTasks.filter((t) => t.type === 'Progression');
      const hybridGoals = yTasks.filter((t) => t.type === 'Hybrid');
      const countGoals = yTasks.filter((t) => t.type === 'Simple' && t.totalProgress);

      const [progressEntries, subtaskEntries, countEntries] = await Promise.all([
        Promise.all(progressionGoals.map(async (t) => [t.id, await getEffectiveProgress(t.id)] as const)),
        Promise.all(hybridGoals.map(async (t) => [t.id, await getSubtaskCounts(t.id)] as const)),
        Promise.all(countGoals.map(async (t) => [t.id, await getCompletedOccurrenceCount(t.id)] as const)),
      ]);

      setGoalProgress(Object.fromEntries(progressEntries));
      setGoalSubtasks(Object.fromEntries(subtaskEntries));
      setGoalOccurrences(Object.fromEntries(countEntries));
    } catch (error) {
      console.error('Failed to load year data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [yearStartStr, yearEndStr]);

  useFocusEffect(
    useCallback(() => {
      loadYearData();
    }, [loadYearData])
  );

  const handleMonthPress = async (month: Date) => {
    const monthStartStr = format(startOfMonth(month), 'yyyy-MM-dd');
    const monthEndStr = format(endOfMonth(month), 'yyyy-MM-dd');
    setSelectedMonthStr(monthStartStr);
    const items = await getTasksForDateRange(monthStartStr, monthEndStr);
    setMonthSummary(items);
  };

  const toggleSelectTask = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
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
      `Are you sure you want to delete ${selectedIds.length} selected goal(s)? This also removes their monthly/weekly/daily breakdown.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              await deleteTaskCascade(id);
            }
            setSelectedIds([]);
            setSelectionMode(false);
            loadYearData();
          },
        },
      ]
    );
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleSelectAllYearly = () => {
    setSelectedIds(yearlyTasks.map((t) => t.id));
  };

  const handleEditSingleSelected = () => {
    if (selectedIds.length !== 1) return;
    const task = yearlyTasks.find((t) => t.id === selectedIds[0]);
    exitSelectionMode();
    if (task) {
      setSelectedTaskToEdit(task);
      yearlyModalRef.current?.expand();
    }
  };

  const nextYear = () => setCurrentYear(addYears(currentYear, 1));
  const prevYear = () => setCurrentYear(subYears(currentYear, 1));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.outerContainer}>
        {selectionMode && (
          <View style={[styles.selectionHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={exitSelectionMode} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.selectionCountText}>{selectedIds.length} selected</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={handleSelectAllYearly} hitSlop={8}>
                <Ionicons name="checkbox-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditSingleSelected}
                disabled={selectedIds.length !== 1}
                hitSlop={8}
              >
                <Ionicons
                  name="pencil-outline"
                  size={20}
                  color={selectedIds.length === 1 ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBatchDelete}
                disabled={selectedIds.length === 0}
                hitSlop={8}
              >
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
            <TouchableOpacity onPress={prevYear} style={styles.navButton}>
              <Text style={styles.navButtonText}>◀</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.yearTitle}>{format(currentYear, 'yyyy')}</Text>
              {isYearEligible && (
                <TouchableOpacity
                  onPress={() => noteSheetRef.current?.expand()}
                  hitSlop={10}
                  style={styles.reflectionBtn}
                >
                  <Ionicons name="document-text-outline" size={20} color={colors.accent} />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedTaskToEdit(null);
                  yearlyModalRef.current?.expand();
                }}
                style={styles.addYearlyHeaderBtn}
              >
                <Ionicons name="add" size={18} color={colors.textOnAccent} />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextYear} style={styles.navButton}>
                <Text style={styles.navButtonText}>▶</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.gridContainer}>
            {monthsGrid.map((month, index) => {
              const monthKey = format(month, 'yyyy-MM');
              const stats = monthData[monthKey];
              const isSelected = format(startOfMonth(month), 'yyyy-MM-dd') === selectedMonthStr;
              const isCurrentMonth = isSameMonth(month, new Date());

              let dotColor = 'transparent';
              if (stats && stats.total > 0) {
                if (stats.completed === stats.total) dotColor = colors.success;
                else if (stats.completed > 0) dotColor = colors.priorityMediumBorder;
                else dotColor = colors.priorityHighBorder;
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.monthCell,
                    isSelected && styles.selectedMonthCell,
                    isCurrentMonth && styles.todayMonthCell,
                  ]}
                  onPress={() => handleMonthPress(month)}
                >
                  <Text style={styles.monthText}>{format(month, 'MMM')}</Text>
                  <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.summaryContainer}>
            <Text style={styles.summaryHeader}>{format(new Date(selectedMonthStr), 'MMMM yyyy')}</Text>
            {monthSummary.length === 0 ? (
              <Text style={styles.emptySummary}>Nothing scheduled.</Text>
            ) : (
              monthSummary.slice(0, 8).map((task) => (
                <View key={task.id} style={styles.summaryCard}>
                  <Text style={[styles.summaryTaskTitle, task.isCompleted && styles.completedTaskTitle]}>
                    {task.isCompleted ? '✓ ' : '• '}{task.title}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.summaryContainer}>
            <Text style={styles.summaryHeader}>Yearly Goals</Text>
            {yearlyTasks.length === 0 ? (
              <Text style={styles.emptySummary}>No yearly goals set.</Text>
            ) : (
              yearlyTasks.map((task) => (
                <GoalCard
                  key={task.id}
                  task={task}
                  scopeLabel="year"
                  effectiveProgress={goalProgress[task.id]}
                  completedOccurrences={goalOccurrences[task.id]}
                  subtaskCounts={goalSubtasks[task.id]}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.includes(task.id)}
                  onPress={() => {
                    if (selectionMode) toggleSelectTask(task.id);
                  }}
                  onLongPress={() => handleLongPressTask(task)}
                />
              ))
            )}
          </View>
        </ScrollView>

        <NewYearlyTaskModal
          sheetRef={yearlyModalRef}
          yearStartDate={yearStartStr}
          yearEndDate={yearEndStr}
          editTask={selectedTaskToEdit}
          onTaskCreated={loadYearData}
          onClose={() => setSelectedTaskToEdit(null)}
        />

        <NoteSheet
          sheetRef={noteSheetRef}
          scope="yearly"
          dateKey={yearStartStr}
          periodLabel={format(currentYear, 'yyyy')}
          getSeed={() => generatePeriodSeed('yearly', yearStartStr, yearEndStr)}
        />
      </View>
    </GestureHandlerRootView>
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reflectionBtn: {
    padding: 4,
  },
  yearTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  navButton: { padding: 10, backgroundColor: colors.surface, borderRadius: 8 },
  navButtonText: { color: colors.accent, fontSize: 16, fontWeight: 'bold' },
  addYearlyHeaderBtn: {
    backgroundColor: colors.accent,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  monthCell: { width: '25%', aspectRatio: 1.3, alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 8 },
  selectedMonthCell: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accent },
  todayMonthCell: { backgroundColor: colors.surfaceSubtle },
  monthText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  summaryContainer: { marginTop: 24, backgroundColor: colors.surface, borderRadius: 12, padding: 16 },
  summaryHeader: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  emptySummary: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  summaryCard: {
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  summaryTaskTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  completedTaskTitle: { textDecorationLine: 'line-through', color: colors.textMuted },
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
  selectionCountText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
});