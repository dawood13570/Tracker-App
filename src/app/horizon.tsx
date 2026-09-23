import { ActivityCard } from '@/components/ActivityCard';
import { GhostTaskCard } from '@/components/GhostTaskCard';
import { GoalCard } from '@/components/GoalCard';
import NoteSheet from '@/components/NoteSheet';
import { PeriodGoalModal } from '@/components/PeriodGoalModal';
import ProgressLogSheet from '@/components/ProgressLogSheet';
import { TagFilterBar } from '@/components/TagFilterBar';
import { TaskCard } from '@/components/TaskCard';
import {
  deleteTaskCascade,
  ensureDailyDecompositionForDate,
  EventRow,
  getActivityLogsForDateRange,
  getAllCustomGoals,
  getAllDescendantTasks,
  getAllTagAssociations,
  getCompletedOccurrenceCount,
  getEffectiveProgress,
  getEventsForDateRange,
  getHabitsByDate,
  getMonthlyTasks,
  getProgressLogsByTask,
  getSubtaskCounts,
  getSubtaskCountsForTaskIds,
  getTasksForDateRange,
  getWeeklyTasks,
  getYearlyTasks,
  HabitWithStatus,
  insertTask,
  logHabitCompletion,
  previewOccurrenceSchedule,
  ProjectedOccurrence,
  TaskRow,
} from '@/db/queries';
import { generatePeriodSeed } from '@/engine/notesSeed';
import { calculatePace, PaceResult } from '@/engine/pace';
import { shouldShowPaceStatus } from '@/engine/paceConfidence';
import { taskHasProgress } from '@/engine/taskShape';
import { ActivityLogWithDetails } from '@/store/activityStore';
import { useTagStore } from '@/store/tagStore';
import { useTaskStore } from '@/store/taskStore';
import { useColors } from '@/store/themeStore';
import { Palette } from '@/theme/colors';
import { getAppToday } from '@/utils/date';
import { isPeriodEligibleForReflection } from '@/utils/reflections';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getISOWeek,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

type ZoomLevel = 'week' | 'month' | 'year';
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function HorizonScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const todayStr = useMemo(() => getAppToday(), []);

  const weeklyModalRef = useRef<BottomSheet>(null);
  const monthlyModalRef = useRef<BottomSheet>(null);
  const yearlyModalRef = useRef<BottomSheet>(null);
  const progressSheetRef = useRef<BottomSheet>(null);
  const noteSheetRef = useRef<BottomSheet>(null);

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [anchorDate, setAnchorDate] = useState(new Date());

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<number[]>([]);
  const [strictTagFilter, setStrictTagFilter] = useState(false);
  const [tagAssociations, setTagAssociations] = useState<{
    tasks: Record<number, number[]>;
    habits: Record<number, number[]>;
    events: Record<number, number[]>;
    activities: Record<number, number[]>;
  }>({ tasks: {}, habits: {}, events: {}, activities: {} });

  const [periodGoals, setPeriodGoals] = useState<TaskRow[]>([]);
  const [periodRangeTasks, setPeriodRangeTasks] = useState<TaskRow[]>([]);
  const [periodActivities, setPeriodActivities] = useState<ActivityLogWithDetails[]>([]);
  const [periodEvents, setPeriodEvents] = useState<EventRow[]>([]);
  const [dayHabits, setDayHabits] = useState<HabitWithStatus[]>([]);

  const [goalProgress, setGoalProgress] = useState<Record<number, number>>({});
  const [goalSubtasks, setGoalSubtasks] = useState<Record<number, { completed: number; total: number }>>({});
  const [goalOccurrences, setGoalOccurrences] = useState<Record<number, number>>({});
  const [yearlyBreakdownMap, setYearlyBreakdownMap] = useState<Record<string, { total: number; completed: number }>>({});
  const [projectedOccurrences, setProjectedOccurrences] = useState<ProjectedOccurrence[]>([]);

  const [selectedDayStr, setSelectedDayStr] = useState<string>(todayStr);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [paceMap, setPaceMap] = useState<Record<number, PaceResult>>({});
  const [subtaskMap, setSubtaskMap] = useState<Record<number, { completed: number; total: number }>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({});
  const [loggingTask, setLoggingTask] = useState<TaskRow | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedTaskToEdit, setSelectedTaskToEdit] = useState<TaskRow | null>(null);

  const [customGoals, setCustomGoals] = useState<TaskRow[]>([]);
  const [customGoalProgress, setCustomGoalProgress] = useState<Record<number, number>>({});
  const [customGoalSubtasks, setCustomGoalSubtasks] = useState<Record<number, { completed: number; total: number }>>({});
  const [customGoalOccurrences, setCustomGoalOccurrences] = useState<Record<number, number>>({});
  const [editingCustomGoal, setEditingCustomGoal] = useState<TaskRow | null>(null);
  const customModalRef = useRef<BottomSheet>(null);

  const { toggleTask } = useTaskStore();
  const { tags: allTags, loadTags, loadMostUsedTags, tagVersion } = useTagStore();

  const bounds = useMemo(() => {
    if (zoomLevel === 'week') {
      return { start: startOfWeek(anchorDate, { weekStartsOn: 1 }), end: endOfWeek(anchorDate, { weekStartsOn: 1 }) };
    } else if (zoomLevel === 'month') {
      return { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
    } else {
      return { start: startOfYear(anchorDate), end: endOfYear(anchorDate) };
    }
  }, [zoomLevel, anchorDate]);

  const startStr = format(bounds.start, 'yyyy-MM-dd');
  const endStr = format(bounds.end, 'yyyy-MM-dd');
  const isEligibleForNote = useMemo(() => isPeriodEligibleForReflection(bounds.end), [bounds.end]);

  const gridCells = useMemo(() => {
    if (zoomLevel === 'week') return eachDayOfInterval({ start: bounds.start, end: bounds.end });
    if (zoomLevel === 'year') return eachMonthOfInterval({ start: bounds.start, end: bounds.end });
    const calStart = startOfWeek(bounds.start, { weekStartsOn: 1 });
    const calEnd = endOfWeek(bounds.end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [zoomLevel, bounds]);

  const monthWeeks = useMemo(() => {
    if (zoomLevel !== 'month') return [];
    const weeks: Date[][] = [];
    for (let i = 0; i < gridCells.length; i += 7) {
      weeks.push(gridCells.slice(i, i + 7));
    }
    return weeks;
  }, [zoomLevel, gridCells]);

  const headerLabel = useMemo(() => {
    if (zoomLevel === 'week') {
      const sameMonth = format(bounds.start, 'MMM') === format(bounds.end, 'MMM');
      return sameMonth
        ? `${format(bounds.start, 'MMM d')}–${format(bounds.end, 'd, yyyy')}`
        : `${format(bounds.start, 'MMM d')} – ${format(bounds.end, 'MMM d, yyyy')}`;
    }
    if (zoomLevel === 'month') return format(anchorDate, 'MMMM yyyy');
    return format(anchorDate, 'yyyy');
  }, [zoomLevel, anchorDate, bounds]);

  const refreshTagMap = useCallback(async () => {
    const map = await getAllTagAssociations();
    setTagAssociations(map);
  }, []);

  const loadData = useCallback(async () => {
    await ensureDailyDecompositionForDate(todayStr);
    if (startStr > todayStr) {
      await ensureDailyDecompositionForDate(startStr);
    }

    const [rangeTasks, scopedGoals, rangeActivities, rangeEvents, currentDayHabits] = await Promise.all([
      getTasksForDateRange(startStr, endStr),
      zoomLevel === 'week'
        ? getWeeklyTasks(startStr, endStr)
        : zoomLevel === 'month'
        ? getMonthlyTasks(startStr, endStr)
        : getYearlyTasks(startStr, endStr),
      getActivityLogsForDateRange(startStr, endStr),
      getEventsForDateRange(startStr, endStr),
      getHabitsByDate(selectedDayStr),
      loadTags(),
      loadMostUsedTags(),
      refreshTagMap(),
    ]);

    setPeriodRangeTasks(rangeTasks);
    setPeriodGoals(scopedGoals);
    setPeriodActivities(rangeActivities);
    setPeriodEvents(rangeEvents);
    setDayHabits(currentDayHabits);

    const progressionGoals = scopedGoals.filter((t) => t.type === 'Progression');
    const hybridGoals = scopedGoals.filter((t) => t.type === 'Hybrid');
    const countGoals = scopedGoals.filter((t) => t.occurrenceTarget != null && t.occurrenceTarget > 0);

    const [progressEntries, subtaskEntries, countEntries] = await Promise.all([
      Promise.all(progressionGoals.map(async (t) => [t.id, await getEffectiveProgress(t.id)] as const)),
      Promise.all(hybridGoals.map(async (t) => [t.id, await getSubtaskCounts(t.id)] as const)),
      Promise.all(countGoals.map(async (t) => [t.id, await getCompletedOccurrenceCount(t.id)] as const)),
    ]);
    setGoalProgress(Object.fromEntries(progressEntries));
    setGoalSubtasks(Object.fromEntries(subtaskEntries));
    setGoalOccurrences(Object.fromEntries(countEntries));

    const progDaily = rangeTasks.filter(taskHasProgress);

    if (progDaily.length > 0) {
      Promise.all(
        progDaily.map(async (t) => {
          const current = await getEffectiveProgress(t.id);
          const logs = await getProgressLogsByTask(t.id);

          if (!shouldShowPaceStatus(t, logs)) {
            return [t.id, current, undefined] as const;
          }

          const pace = calculatePace({ ...t, currentProgress: current }, logs);
          return [t.id, current, pace] as const;
        })
      ).then((res) => {
        setProgressMap(Object.fromEntries(res.map(([id, c]) => [id, c])));
        setPaceMap(
          Object.fromEntries(
            res
              .filter(([, , p]) => p !== undefined)
              .map(([id, , p]) => [id, p!])
          )
        );
      });
    }

    if (rangeTasks.length > 0) {
      const countsMap = await getSubtaskCountsForTaskIds(rangeTasks.map((t) => t.id));
      setSubtaskMap(countsMap);
    } else {
      setSubtaskMap({});
    }
  }, [zoomLevel, startStr, endStr, todayStr, selectedDayStr, loadTags, loadMostUsedTags, refreshTagMap]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    refreshTagMap();
  }, [tagVersion, refreshTagMap]);

  const filterItems = useCallback(
    <T extends { id: number; title?: string | null }>(
      items: T[],
      type: 'tasks' | 'habits' | 'events' | 'activities'
    ): T[] => {
      const q = searchQuery.trim().toLowerCase();
      return items.filter((item) => {
        const itemTitle = item.title ?? '';
        const matchesText = !q || itemTitle.toLowerCase().includes(q);
        const itemTags = tagAssociations[type][item.id] ?? [];
        const matchesTags =
          selectedFilterTagIds.length === 0 || selectedFilterTagIds.some((id) => itemTags.includes(id));
        return matchesText && matchesTags;
      });
    },
    [searchQuery, selectedFilterTagIds, tagAssociations]
  );

  const isFilterActive = Boolean(searchQuery.trim()) || selectedFilterTagIds.length > 0;

  const filteredGoals = useMemo(() => filterItems(periodGoals, 'tasks'), [filterItems, periodGoals]);
  const filteredRangeTasks = useMemo(() => filterItems(periodRangeTasks, 'tasks'), [filterItems, periodRangeTasks]);
  const filteredEvents = useMemo(() => filterItems(periodEvents, 'events'), [filterItems, periodEvents]);
  const filteredHabits = useMemo(() => filterItems(dayHabits, 'habits'), [filterItems, dayHabits]);

  const handleScheduleGhostNow = (ghost: ProjectedOccurrence) => {
    Alert.alert(
      'Schedule now?',
      `Create "${ghost.goalTitle}" as a real task on ${format(parseISO(ghost.date), 'EEE, MMM d')} instead of waiting for it to auto-generate?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Schedule',
          onPress: async () => {
            await insertTask({
              title: ghost.goalTitle,
              type: ghost.type,
              priority: ghost.priority,
              scheduledDate: ghost.date,
              scope: 'daily',
              sourceTaskId: ghost.goalId,
              totalProgress: ghost.totalProgress ?? null,
              progressUnit: ghost.progressUnit ?? null,
              deadline: ghost.totalProgress ? ghost.date : null,
              rolloverEnabled: false,
            } as any);
            await loadData();
          },
        },
      ]
    );
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const yearStart = format(startOfYear(bounds.start), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(bounds.start), 'yyyy-MM-dd');
      const yearlyGoals = await getYearlyTasks(yearStart, yearEnd);

      const allActiveGoals = [...filteredGoals, ...yearlyGoals.filter((y) => y.occurrenceTarget)];
      const uniqueGoals = Array.from(new Map(allActiveGoals.map((g) => [g.id, g])).values());

      const fromDate = todayStr > startStr ? todayStr : startStr;

      const countResults = (
        await Promise.all(
          uniqueGoals
            .filter((g) => g.occurrenceTarget != null && g.occurrenceTarget > 0)
            .map((g) => previewOccurrenceSchedule(g, fromDate, endStr))
        )
      ).flat();

      if (active) setProjectedOccurrences(countResults);
    })();
    return () => {
      active = false;
    };
  }, [filteredGoals, startStr, endStr, todayStr, bounds.start]);

  const densityMap = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {};
    for (const t of filteredRangeTasks) {
      if (!map[t.scheduledDate]) map[t.scheduledDate] = { total: 0, completed: 0 };
      map[t.scheduledDate].total += 1;
      if (t.isCompleted) map[t.scheduledDate].completed += 1;
    }
    return map;
  }, [filteredRangeTasks]);

  useEffect(() => {
    let active = true;
    if (zoomLevel !== 'year') return;
    (async () => {
      const map: Record<string, { total: number; completed: number }> = {};
      for (const goal of filteredGoals) {
        const descendants = await getAllDescendantTasks(goal.id);
        const leaves = descendants.filter((d) => d.scope === 'daily');
        for (const d of leaves) {
          const key = d.scheduledDate.slice(0, 7);
          if (!map[key]) map[key] = { total: 0, completed: 0 };
          map[key].total += 1;
          if (d.isCompleted) map[key].completed += 1;
        }
      }
      if (active) setYearlyBreakdownMap(map);
    })();
    return () => {
      active = false;
    };
  }, [zoomLevel, filteredGoals]);

  const searchDateKeys = useMemo(() => {
    if (!isFilterActive) return [];
    const set = new Set<string>();
    filteredRangeTasks.forEach((t) => set.add(t.scheduledDate));
    filteredEvents.forEach((e) => set.add(e.startTime.split('T')[0]));
    periodActivities.forEach((a) => {
      const matchesSearch =
        !searchQuery.trim() ||
        a.activityTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.note ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTags =
        selectedFilterTagIds.length === 0 || selectedFilterTagIds.some((id) => a.tagIds.includes(id));
      if (matchesSearch && matchesTags) set.add(a.date);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [isFilterActive, filteredRangeTasks, filteredEvents, periodActivities, searchQuery, selectedFilterTagIds]);

  const singleDayTasks = useMemo(
    () => filteredRangeTasks.filter((t) => t.scheduledDate === selectedDayStr),
    [filteredRangeTasks, selectedDayStr]
  );

  const singleDayGhosts = useMemo(
    () => projectedOccurrences.filter((g) => g.date === selectedDayStr),
    [projectedOccurrences, selectedDayStr]
  );

  const singleDayActivities = useMemo(
    () => periodActivities.filter((a) => a.date === selectedDayStr),
    [periodActivities, selectedDayStr]
  );

  const singleDayEvents = useMemo(
    () => filteredEvents.filter((e) => e.startTime.startsWith(selectedDayStr)),
    [filteredEvents, selectedDayStr]
  );

  const navPrev = () => {
    setAnchorDate((d) =>
      zoomLevel === 'week' ? subWeeks(d, 1) : zoomLevel === 'month' ? subMonths(d, 1) : subYears(d, 1)
    );
  };
  const navNext = () => {
    setAnchorDate((d) =>
      zoomLevel === 'week' ? addWeeks(d, 1) : zoomLevel === 'month' ? addMonths(d, 1) : addYears(d, 1)
    );
  };
  const jumpToToday = () => {
    setAnchorDate(new Date());
    setSelectedDayStr(todayStr);
  };

  const handleZoomOut = () => {
    if (zoomLevel === 'week') setZoomLevel('month');
    else if (zoomLevel === 'month') setZoomLevel('year');
  };

  const handleDrillToMonth = (monthDate: Date) => {
    setAnchorDate(monthDate);
    setZoomLevel('month');
  };
  const handleDrillToWeek = (day: string, weekDayStrs?: string[]) => {
    setAnchorDate(parseISO(day));
    const focusDay = weekDayStrs?.includes(todayStr) ? todayStr : day;
    setSelectedDayStr(focusDay);
    setZoomLevel('week');
  };

  const handleToggleTask = async (taskId: number) => {
    await toggleTask(taskId);
    await loadData();
  };

  const handleToggleHabit = async (habitId: number) => {
    await logHabitCompletion(habitId, selectedDayStr);
    await loadData();
  };

  const toggleSelectTask = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };
  const handleLongPressTask = (task: TaskRow) => {
    if (!selectionMode) {
      setSelectedIds([task.id]);
      setSelectionMode(true);
    }
  };
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };
  const handleEditSelected = () => {
    if (selectedIds.length !== 1) return;
    const task =
      periodGoals.find((t) => t.id === selectedIds[0]) ||
      periodRangeTasks.find((t) => t.id === selectedIds[0]);
    exitSelectionMode();
    if (!task) return;
    setSelectedTaskToEdit(task);
    if (task.scope === 'yearly') yearlyModalRef.current?.expand();
    else if (task.scope === 'monthly') monthlyModalRef.current?.expand();
    else if (task.scope === 'weekly') weeklyModalRef.current?.expand();
  };
  const handleBatchDelete = () => {
    Alert.alert(
      'Delete Selected Items',
      `Delete ${selectedIds.length} item(s)? Subtasks and decomposition trees will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) await deleteTaskCascade(id);
            exitSelectionMode();
            loadData();
          },
        },
      ]
    );
  };

  const loadCustomGoals = useCallback(async () => {
    const list = await getAllCustomGoals();
    setCustomGoals(list);
    const progressionGoals = list.filter((t) => t.type === 'Progression');
    const hybridGoals = list.filter((t) => t.type === 'Hybrid');
    const countGoals = list.filter((t) => t.occurrenceTarget != null && t.occurrenceTarget > 0);
    const [progressEntries, subtaskEntries, countEntries] = await Promise.all([
      Promise.all(progressionGoals.map(async (t) => [t.id, await getEffectiveProgress(t.id)] as const)),
      Promise.all(hybridGoals.map(async (t) => [t.id, await getSubtaskCounts(t.id)] as const)),
      Promise.all(countGoals.map(async (t) => [t.id, await getCompletedOccurrenceCount(t.id)] as const)),
    ]);
    setCustomGoalProgress(Object.fromEntries(progressEntries));
    setCustomGoalSubtasks(Object.fromEntries(subtaskEntries));
    setCustomGoalOccurrences(Object.fromEntries(countEntries));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCustomGoals();
    }, [loadCustomGoals])
  );

  const activeModalRef =
    zoomLevel === 'week' ? weeklyModalRef : zoomLevel === 'month' ? monthlyModalRef : yearlyModalRef;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar
          barStyle={colors.background === '#121212' ? 'light-content' : 'dark-content'}
          backgroundColor={colors.surface}
        />

        <View style={styles.stickyHeader}>
          {selectionMode ? (
            <View style={styles.selectionBar}>
              <Pressable onPress={exitSelectionMode} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
              <Text style={styles.selectionCountText}>{selectedIds.length} selected</Text>
              <View style={styles.selectionActions}>
                <Pressable
                  onPress={() => setSelectedIds([...periodGoals, ...periodRangeTasks].map((t) => t.id))}
                  hitSlop={8}
                >
                  <Ionicons name="checkbox-outline" size={22} color={colors.accent} />
                </Pressable>
                <Pressable
                  onPress={handleEditSelected}
                  disabled={selectedIds.length !== 1}
                  hitSlop={8}
                  style={selectedIds.length !== 1 && { opacity: 0.35 }}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={22}
                    color={selectedIds.length === 1 ? colors.accent : colors.textMuted}
                  />
                </Pressable>
                <Pressable onPress={handleBatchDelete} hitSlop={8}>
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <View style={styles.headerLeftGroup}>
                  {zoomLevel === 'year' ? (
                    <Text style={styles.headerTitle} numberOfLines={1}>
                      {headerLabel}
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleZoomOut} style={styles.headerTitlePressable} hitSlop={8}>
                      <Text style={styles.headerTitle} numberOfLines={1}>
                        {headerLabel}
                      </Text>
                      <Ionicons name="chevron-up-circle-outline" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                  {isEligibleForNote && (
                    <TouchableOpacity onPress={() => noteSheetRef.current?.expand()} hitSlop={8}>
                      <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={navPrev} style={styles.navBtn}>
                  <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={jumpToToday}>
                  <Text style={styles.todayBtnText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={navNext} style={styles.navBtn}>
                  <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <TagFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTagIds={selectedFilterTagIds}
          onToggleTag={(id) =>
            setSelectedFilterTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
          }
          onClearAllTags={() => setSelectedFilterTagIds([])}
          strictOnly={strictTagFilter}
          onToggleStrictOnly={setStrictTagFilter}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.matrixWrapper}>
            {zoomLevel !== 'year' && (
              <View style={styles.weekLabelsRow}>
                {zoomLevel === 'month' && <View style={styles.weekNumSpacer} />}
                {WEEKDAYS.map((day, idx) => (
                  <Text key={`${day}-${idx}`} style={styles.weekLabelText}>
                    {day}
                  </Text>
                ))}
              </View>
            )}

            {zoomLevel === 'year' ? (
              <View style={styles.yearGridContainer}>
                {gridCells.map((monthDate, index) => {
                  const mKey = format(monthDate, 'yyyy-MM');
                  const stats = yearlyBreakdownMap[mKey];
                  const count = stats?.total ?? 0;
                  const completed = stats?.completed ?? 0;
                  const isCurrent = isSameMonth(monthDate, new Date());

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.yearMonthCard, isCurrent && styles.yearMonthCardCurrent]}
                      onPress={() => handleDrillToMonth(monthDate)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.yearMonthCardTop}>
                        <Text style={[styles.yearMonthName, isCurrent && styles.yearMonthNameCurrent]}>
                          {format(monthDate, 'MMM')}
                        </Text>
                        <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.textMuted} />
                      </View>
                      <View style={styles.yearProgressTrack}>
                        <View
                          style={[
                            styles.yearProgressFill,
                            { width: count > 0 ? `${Math.round((completed / count) * 100)}%` : '0%' },
                          ]}
                        />
                      </View>
                      <Text style={styles.yearFooterText}>
                        {count > 0
                          ? `${completed}/${count}${isFilterActive ? ' matching' : ''} tasks`
                          : isFilterActive
                          ? 'No matches'
                          : 'No activity'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : zoomLevel === 'month' ? (
              <View>
                {monthWeeks.map((weekDays, wIdx) => {
                  const weekNum = getISOWeek(weekDays[0]);
                  const weekStartRowStr = format(weekDays[0], 'yyyy-MM-dd');
                  const weekDayStrs = weekDays.map((d) => format(d, 'yyyy-MM-dd'));

                  return (
                    <View key={wIdx} style={styles.monthWeekRow}>
                      <TouchableOpacity
                        style={styles.weekNumCell}
                        onPress={() => handleDrillToWeek(weekStartRowStr, weekDayStrs)}
                      >
                        <Text style={styles.weekNumText}>{weekNum}</Text>
                      </TouchableOpacity>
                      {weekDays.map((cell, index) => {
                        const dStr = format(cell, 'yyyy-MM-dd');
                        const stats = densityMap[dStr];
                        const isSelected = dStr === selectedDayStr;
                        const isToday = isSameDay(cell, new Date());
                        const isOutsideMonth = !isSameMonth(cell, anchorDate);

                        let dotColor = 'transparent';
                        if (stats && stats.total > 0) {
                          dotColor =
                            stats.completed === stats.total
                              ? colors.success
                              : stats.completed > 0
                              ? colors.priorityMediumBorder
                              : colors.priorityHighBorder;
                        }

                        return (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.monthDayCell,
                              isSelected && styles.cellActive,
                              isToday && styles.cellToday,
                              isOutsideMonth && styles.cellMuted,
                            ]}
                            onPress={() => setSelectedDayStr(dStr)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.cellNum,
                                isOutsideMonth && styles.cellNumMuted,
                                isSelected && styles.cellNumSelected,
                              ]}
                            >
                              {format(cell, 'd')}
                            </Text>
                            <View style={[styles.densityDot, { backgroundColor: dotColor }]} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.gridContainer, styles.gridContainerWeek]}>
                {gridCells.map((cell, index) => {
                  const dStr = format(cell, 'yyyy-MM-dd');
                  const stats = densityMap[dStr];
                  const isSelected = dStr === selectedDayStr;
                  const isToday = isSameDay(cell, new Date());

                  let dotColor = 'transparent';
                  if (stats && stats.total > 0) {
                    dotColor =
                      stats.completed === stats.total
                        ? colors.success
                        : stats.completed > 0
                        ? colors.priorityMediumBorder
                        : colors.priorityHighBorder;
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.weekCell, isSelected && styles.cellActive, isToday && styles.cellToday]}
                      onPress={() => setSelectedDayStr(dStr)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.cellNum, isSelected && styles.cellNumSelected]}>{format(cell, 'd')}</Text>
                      <View style={[styles.densityDot, { backgroundColor: dotColor }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Period Goals Section with inline + button */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderLine}>
              <Text style={styles.sectionHeaderTitle}>
                {zoomLevel === 'week' ? 'WEEKLY GOALS' : zoomLevel === 'month' ? 'MONTHLY GOALS' : 'YEARLY GOALS'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.sectionItemCount}>{filteredGoals.length}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTaskToEdit(null);
                    activeModalRef.current?.expand();
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                </TouchableOpacity>
              </View>
            </View>

            {filteredGoals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="flag-outline" size={20} color={colors.textMuted} style={{ opacity: 0.5 }} />
                <Text style={styles.emptyCardText}>
                  {isFilterActive ? 'No matching goals.' : `No ${zoomLevel} goals set.`}
                </Text>
              </View>
            ) : (
              filteredGoals.map((task) => (
                <GoalCard
                  key={task.id}
                  task={task}
                  scopeLabel={zoomLevel}
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

          {/* Custom Goals Section */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderLine}>
              <Text style={styles.sectionHeaderTitle}>CUSTOM GOALS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.sectionItemCount}>{customGoals.length}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditingCustomGoal(null);
                    customModalRef.current?.expand();
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                </TouchableOpacity>
              </View>
            </View>
            {customGoals.length === 0 ? (
              <Text style={styles.emptyNotice}>No custom-range goals yet — tap + to plan one with its own dates.</Text>
            ) : (
              customGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  task={goal}
                  scopeLabel="custom"
                  effectiveProgress={customGoalProgress[goal.id]}
                  completedOccurrences={customGoalOccurrences[goal.id]}
                  subtaskCounts={customGoalSubtasks[goal.id]}
                  onPress={() => {
                    setEditingCustomGoal(goal);
                    customModalRef.current?.expand();
                  }}
                  onLongPress={() => {
                    Alert.alert('Delete Goal', `Delete "${goal.title}"? This removes its generated daily tasks too.`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteTaskCascade(goal.id);
                          await loadCustomGoals();
                        },
                      },
                    ]);
                  }}
                />
              ))
            )}
          </View>

          {isFilterActive ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderLine}>
                <Text style={styles.sectionHeaderTitle}>MATCHING DAYS IN SCOPE</Text>
                <Text style={styles.sectionItemCount}>{searchDateKeys.length}</Text>
              </View>
              {searchDateKeys.length === 0 ? (
                <Text style={styles.emptyNotice}>No items match your search in this {zoomLevel}.</Text>
              ) : (
                searchDateKeys.map((dateKey) => {
                  const tasksOnDay = filteredRangeTasks.filter((t) => t.scheduledDate === dateKey);
                  const eventsOnDay = filteredEvents.filter((e) => e.startTime.startsWith(dateKey));
                  const activitiesOnDay = periodActivities.filter((a) => {
                    const matchesDate = a.date === dateKey;
                    const matchesSearch =
                      !searchQuery.trim() ||
                      a.activityTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (a.note ?? '').toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesTags =
                      selectedFilterTagIds.length === 0 || selectedFilterTagIds.some((id) => a.tagIds.includes(id));
                    return matchesDate && matchesSearch && matchesTags;
                  });

                  return (
                    <View key={dateKey} style={styles.dayGroupContainer}>
                      <View style={styles.dayGroupHeader}>
                        <Text style={styles.dayGroupTitle}>
                          {format(parseISO(dateKey), 'EEEE, MMM d, yyyy')}
                        </Text>
                        {zoomLevel === 'month' && (
                          <TouchableOpacity style={styles.drillWeekBtn} onPress={() => handleDrillToWeek(dateKey)}>
                            <Text style={styles.drillWeekBtnText}>Open Week</Text>
                            <Ionicons name="arrow-forward" size={12} color={colors.accent} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {eventsOnDay.map((evt) => (
                        <View key={`event-search-${evt.id}`} style={styles.eventRowCard}>
                          <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.eventTitle}>{evt.title}</Text>
                            <Text style={styles.eventMeta}>
                              {evt.startTime.split('T')[1]?.slice(0, 5) ?? 'All Day'}
                              {evt.location ? ` · ${evt.location}` : ''}
                            </Text>
                          </View>
                        </View>
                      ))}

                      {activitiesOnDay.map((entry) => (
                        <ActivityCard
                          key={`activity-search-${entry.id}`}
                          entry={entry}
                          tags={allTags?.filter((t) => entry.tagIds.includes(t.id)) ?? []}
                          selectionMode={false}
                          isSelected={false}
                          onPressCard={() => {}}
                          onLongPressCard={() => {}}
                          onToggleSelect={() => {}}
                        />
                      ))}

                      {tasksOnDay.length > 0 && (
                        <View
                          style={{
                            gap: 8,
                            marginTop: eventsOnDay.length > 0 || activitiesOnDay.length > 0 ? 6 : 0,
                          }}
                        >
                          {tasksOnDay.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task as any}
                              onToggle={() => handleToggleTask(task.id)}
                              onProgressChanged={loadData}
                              currentProgress={progressMap[task.id]}
                              pace={paceMap[task.id]}
                              subtaskCount={subtaskMap[task.id]}
                              isExpanded={Boolean(expandedTaskIds[task.id])}
                              onToggleExpand={() =>
                                setExpandedTaskIds((prev) => ({ ...prev, [task.id]: !prev[task.id] }))
                              }
                              onSubtasksCountUpdate={(taskId, comp, tot) =>
                                setSubtaskMap((prev) => ({ ...prev, [taskId]: { completed: comp, total: tot } }))
                              }
                              selectionMode={selectionMode}
                              isSelected={selectedIds.includes(task.id)}
                              onLongPressCard={() => handleLongPressTask(task)}
                              onToggleSelect={() => toggleSelectTask(task.id)}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            zoomLevel !== 'year' && (
              <View style={styles.sectionBlock}>
                <View style={styles.dayFocusHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.sectionHeaderTitle}>
                      {format(parseISO(selectedDayStr), 'EEEE, MMM d')}
                    </Text>
                    {selectedDayStr === todayStr && (
                      <View style={styles.todayBadge}>
                        <Text style={styles.todayBadgeText}>TODAY</Text>
                      </View>
                    )}
                  </View>
                  {zoomLevel === 'month' && (
                    <TouchableOpacity style={styles.drillWeekBtn} onPress={() => handleDrillToWeek(selectedDayStr)}>
                      <Text style={styles.drillWeekBtnText}>Open Week</Text>
                      <Ionicons name="arrow-forward" size={12} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>

                {singleDayEvents.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.subCategoryTitle}>EVENTS</Text>
                    {singleDayEvents.map((evt) => (
                      <View key={`event-${evt.id}`} style={styles.eventRowCard}>
                        <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.eventTitle}>{evt.title}</Text>
                          <Text style={styles.eventMeta}>
                            {evt.startTime.split('T')[1]?.slice(0, 5) ?? 'All Day'}
                            {evt.location ? ` · ${evt.location}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {filteredHabits.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.subCategoryTitle}>HABITS</Text>
                    {filteredHabits.map((habit) => (
                      <TouchableOpacity
                        key={`habit-${habit.id}`}
                        style={styles.habitRowCard}
                        onPress={() => handleToggleHabit(habit.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={habit.isCompletedToday ? 'checkmark-circle' : 'ellipse-outline'}
                          size={18}
                          color={habit.isCompletedToday ? colors.accent : colors.textMuted}
                        />
                        <Text style={[styles.habitTitle, habit.isCompletedToday && styles.habitDone]}>
                          {habit.title}
                        </Text>
                        <Text style={styles.habitStreak}>🔥 {habit.streak}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {singleDayActivities.length > 0 && (
                  <View style={{ marginBottom: 12, gap: 8 }}>
                    <Text style={styles.subCategoryTitle}>ACTIVITIES</Text>
                    {singleDayActivities.map((entry) => (
                      <ActivityCard
                        key={`activity-${entry.id}`}
                        entry={entry}
                        tags={allTags?.filter((t) => entry.tagIds.includes(t.id)) ?? []}
                        selectionMode={false}
                        isSelected={false}
                        onPressCard={() => {}}
                        onLongPressCard={() => {}}
                        onToggleSelect={() => {}}
                      />
                    ))}
                  </View>
                )}

                <View>
                  <Text style={styles.subCategoryTitle}>TASKS</Text>
                  {singleDayTasks.length === 0 && singleDayGhosts.length === 0 ? (
                    <Text style={styles.emptyNotice}>No tasks scheduled or projected for this day.</Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {singleDayTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task as any}
                          onToggle={() => handleToggleTask(task.id)}
                          onProgressChanged={loadData}
                          currentProgress={progressMap[task.id]}
                          pace={paceMap[task.id]}
                          subtaskCount={subtaskMap[task.id]}
                          isExpanded={Boolean(expandedTaskIds[task.id])}
                          onToggleExpand={() =>
                            setExpandedTaskIds((prev) => ({ ...prev, [task.id]: !prev[task.id] }))
                          }
                          onSubtasksCountUpdate={(taskId, comp, tot) =>
                            setSubtaskMap((prev) => ({ ...prev, [taskId]: { completed: comp, total: tot } }))
                          }
                          selectionMode={selectionMode}
                          isSelected={selectedIds.includes(task.id)}
                          onLongPressCard={() => handleLongPressTask(task)}
                          onToggleSelect={() => toggleSelectTask(task.id)}
                        />
                      ))}

                      {singleDayGhosts.map((ghost, index) => (
                        <GhostTaskCard
                          key={`ghost-${ghost.goalId}-${index}`}
                          title={ghost.goalTitle}
                          priority={ghost.priority}
                          totalProgress={ghost.totalProgress}
                          progressUnit={ghost.progressUnit}
                          onPress={() => handleScheduleGhostNow(ghost)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )
          )}
        </ScrollView>

        <PeriodGoalModal
          sheetRef={weeklyModalRef}
          scope="weekly"
          startDate={format(startOfWeek(anchorDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')}
          endDate={format(endOfWeek(anchorDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')}
          editTask={zoomLevel === 'week' ? selectedTaskToEdit : null}
          onTaskCreated={loadData}
          onClose={() => setSelectedTaskToEdit(null)}
        />
        <PeriodGoalModal
          sheetRef={monthlyModalRef}
          scope="monthly"
          startDate={format(startOfMonth(anchorDate), 'yyyy-MM-dd')}
          endDate={format(endOfMonth(anchorDate), 'yyyy-MM-dd')}
          editTask={zoomLevel === 'month' ? selectedTaskToEdit : null}
          onTaskCreated={loadData}
          onClose={() => setSelectedTaskToEdit(null)}
        />
        <PeriodGoalModal
          sheetRef={yearlyModalRef}
          scope="yearly"
          startDate={format(startOfYear(anchorDate), 'yyyy-MM-dd')}
          endDate={format(endOfYear(anchorDate), 'yyyy-MM-dd')}
          editTask={zoomLevel === 'year' ? selectedTaskToEdit : null}
          onTaskCreated={loadData}
          onClose={() => setSelectedTaskToEdit(null)}
        />
        <PeriodGoalModal
          sheetRef={customModalRef}
          scope="custom"
          startDate={todayStr}
          endDate={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
          editTask={editingCustomGoal}
          onTaskCreated={loadCustomGoals}
          onClose={() => setEditingCustomGoal(null)}
        />
        <ProgressLogSheet
          sheetRef={progressSheetRef}
          task={loggingTask}
          currentProgress={loggingTask ? progressMap[loggingTask.id] ?? 0 : 0}
          pace={loggingTask ? paceMap[loggingTask.id] : undefined}
          onLogged={() => loadData()}
          onClose={() => setLoggingTask(null)}
        />
        <NoteSheet
          sheetRef={noteSheetRef}
          scope={zoomLevel === 'week' ? 'weekly' : zoomLevel === 'month' ? 'monthly' : 'yearly'}
          dateKey={startStr}
          periodLabel={headerLabel}
          getSeed={() =>
            generatePeriodSeed(
              zoomLevel === 'week' ? 'weekly' : zoomLevel === 'month' ? 'monthly' : 'yearly',
              startStr,
              endStr
            )
          }
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    stickyHeader: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.borderSubtle,
      elevation: 2,
    },
    headerContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'center' },
    headerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
    headerTitlePressable: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, flexShrink: 1 },
    navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    navBtn: { padding: 4 },
    todayBtnText: { fontSize: 18, fontWeight: '700', color: colors.accent },
    selectionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    selectionCountText: { fontSize: 15, color: colors.textPrimary, fontWeight: '700' },
    selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 60 },
    matrixWrapper: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: 10,
      marginBottom: 16,
    },
    weekLabelsRow: {
      flexDirection: 'row',
      marginBottom: 6,
      paddingBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    },
    weekNumSpacer: { width: 26 },
    weekLabelText: { flex: 1, fontSize: 10, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
    gridContainerWeek: { flexWrap: 'nowrap' },
    monthWeekRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 1 },
    weekNumCell: { width: 26, alignItems: 'center', justifyContent: 'center' },
    weekNumText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
    monthDayCell: { flex: 1, aspectRatio: 1.15, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
    weekCell: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    cellActive: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accent },
    cellToday: { backgroundColor: colors.surfaceSubtle },
    cellMuted: { opacity: 0.22 },
    cellNum: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    cellNumMuted: { color: colors.textMuted },
    cellNumSelected: { color: colors.accent, fontWeight: '700' },
    densityDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
    yearGridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    yearMonthCard: {
      width: '31%',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: 10,
      gap: 6,
    },
    yearMonthCardCurrent: { borderColor: colors.accent },
    yearMonthCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    yearMonthName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    yearMonthNameCurrent: { color: colors.accent },
    yearProgressTrack: { height: 4, backgroundColor: colors.surfaceSubtle, borderRadius: 2, overflow: 'hidden' },
    yearProgressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
    yearFooterText: { fontSize: 10, color: colors.textMuted },
    sectionBlock: { marginBottom: 20 },
    sectionHeaderLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    sectionHeaderTitle: { fontSize: 11, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.8 },
    sectionItemCount: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderStyle: 'dashed',
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    emptyCardText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
    emptyNotice: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', paddingVertical: 8 },
    dayFocusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    todayBadge: { backgroundColor: colors.accent, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
    todayBadgeText: { fontSize: 9, fontWeight: '800', color: colors.textOnAccent },
    drillWeekBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
    drillWeekBtnText: { fontSize: 11, fontWeight: '700', color: colors.accent },
    dayGroupContainer: { marginBottom: 14 },
    dayGroupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
      paddingBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    },
    dayGroupTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    subCategoryTitle: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 6,
      marginTop: 4,
    },
    eventRowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surfaceElevated,
      padding: 10,
      borderRadius: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    eventTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    eventMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    habitRowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surfaceElevated,
      padding: 10,
      borderRadius: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    habitTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flex: 1 },
    habitDone: { textDecorationLine: 'line-through', color: colors.textMuted },
    habitStreak: { fontSize: 12, fontWeight: '700', color: colors.accent },
  });