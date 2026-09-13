// src/app/(tabs)/horizon.tsx
import { GoalCard } from '@/components/GoalCard';
import NewMonthlyTaskModal from '@/components/NewMonthlyTaskModal';
import NewWeeklyTaskModal from '@/components/NewWeeklyTaskModal';
import NewYearlyTaskModal from '@/components/NewYearlyTaskModal';
import NoteSheet from '@/components/NoteSheet';
import ProgressLogSheet from '@/components/ProgressLogSheet';
import { TagFilterBar } from '@/components/TagFilterBar';
import { TaskCard } from '@/components/TaskCard';
import {
    deleteTaskCascade,
    ensureDailyDecompositionForDate,
    getAllDescendantTasks,
    getAllTagAssociations,
    getCompletedOccurrenceCount,
    getEffectiveProgress,
    getMonthlyTasks,
    getProgressLogsByTask,
    getSubtaskCounts,
    getTasksForDateRange,
    getWeeklyTasks,
    getYearlyTasks,
    TaskRow,
} from '@/db/queries';
import { generatePeriodSeed } from '@/engine/notesSeed';
import { calculatePace, PaceResult } from '@/engine/pace';
import { useTagStore } from '@/store/tagStore';
import { useTaskStore } from '@/store/taskStore';
import { colors } from '@/theme/colors';
import { getAppToday } from '@/utils/date';
import { isPeriodEligibleForReflection } from '@/utils/reflections';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import {
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
  const [goalProgress, setGoalProgress] = useState<Record<number, number>>({});
  const [goalSubtasks, setGoalSubtasks] = useState<Record<number, { completed: number; total: number }>>({});
  const [goalOccurrences, setGoalOccurrences] = useState<Record<number, number>>({});
  const [yearlyBreakdownMap, setYearlyBreakdownMap] = useState<Record<string, { total: number; completed: number }>>({});

  const [selectedDayStr, setSelectedDayStr] = useState<string>(todayStr);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [paceMap, setPaceMap] = useState<Record<number, PaceResult>>({});
  const [subtaskMap, setSubtaskMap] = useState<Record<number, { completed: number; total: number }>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({});
  const [loggingTask, setLoggingTask] = useState<TaskRow | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedTaskToEdit, setSelectedTaskToEdit] = useState<TaskRow | null>(null);

  const { toggleTask } = useTaskStore();
  const { loadTags, loadMostUsedTags, tagVersion } = useTagStore();

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

  // NEW — month grid chunked into week-rows, each row gets a week-number column
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

    const [rangeTasks, scopedGoals] = await Promise.all([
      getTasksForDateRange(startStr, endStr),
      zoomLevel === 'week'
        ? getWeeklyTasks(startStr, endStr)
        : zoomLevel === 'month'
        ? getMonthlyTasks(startStr, endStr)
        : getYearlyTasks(startStr, endStr),
      loadTags(),
      loadMostUsedTags(),
      refreshTagMap(),
    ]);

    setPeriodRangeTasks(rangeTasks);
    setPeriodGoals(scopedGoals);

    const progressionGoals = scopedGoals.filter((t) => t.type === 'Progression');
    const hybridGoals = scopedGoals.filter((t) => t.type === 'Hybrid');
    const countGoals = scopedGoals.filter((t) => t.type === 'Simple' && t.totalProgress);

    const [progressEntries, subtaskEntries, countEntries] = await Promise.all([
      Promise.all(progressionGoals.map(async (t) => [t.id, await getEffectiveProgress(t.id)] as const)),
      Promise.all(hybridGoals.map(async (t) => [t.id, await getSubtaskCounts(t.id)] as const)),
      Promise.all(countGoals.map(async (t) => [t.id, await getCompletedOccurrenceCount(t.id)] as const)),
    ]);
    setGoalProgress(Object.fromEntries(progressEntries));
    setGoalSubtasks(Object.fromEntries(subtaskEntries));
    setGoalOccurrences(Object.fromEntries(countEntries));

    const progDaily = rangeTasks.filter((t) => t.type === 'Progression');
    const hybDaily = rangeTasks.filter((t) => t.type === 'Hybrid');

    if (progDaily.length > 0) {
      Promise.all(
        progDaily.map(async (t) => {
          const current = await getEffectiveProgress(t.id);
          const logs = await getProgressLogsByTask(t.id);
          const pace = calculatePace({ ...t, currentProgress: current }, logs);
          return [t.id, current, pace] as const;
        })
      ).then((res) => {
        setProgressMap(Object.fromEntries(res.map(([id, c]) => [id, c])));
        setPaceMap(Object.fromEntries(res.map(([id, , p]) => [id, p])));
      });
    }

    if (hybDaily.length > 0) {
      Promise.all(hybDaily.map(async (t) => [t.id, await getSubtaskCounts(t.id)] as const)).then((res) =>
        setSubtaskMap(Object.fromEntries(res))
      );
    }
  }, [zoomLevel, startStr, endStr, todayStr, loadTags, loadMostUsedTags, refreshTagMap]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    refreshTagMap();
  }, [tagVersion, refreshTagMap]);

  const filterItems = useCallback(
    <T extends { id: number; title: string }>(items: T[]): T[] => {
      const q = searchQuery.trim().toLowerCase();
      return items.filter((item) => {
        const matchesText = !q || item.title.toLowerCase().includes(q);
        const itemTags = tagAssociations.tasks[item.id] ?? [];
        const matchesTags =
          selectedFilterTagIds.length === 0 || selectedFilterTagIds.some((id) => itemTags.includes(id));
        return matchesText && matchesTags;
      });
    },
    [searchQuery, selectedFilterTagIds, strictTagFilter, tagAssociations.tasks]
  );

  const isFilterActive = Boolean(searchQuery.trim()) || selectedFilterTagIds.length > 0;

  const filteredGoals = useMemo(() => filterItems(periodGoals), [filterItems, periodGoals]);
  const filteredRangeTasks = useMemo(() => filterItems(periodRangeTasks), [filterItems, periodRangeTasks]);

  // Week/Month density — already search/tag-aware since it derives from filteredRangeTasks
  const densityMap = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {};
    for (const t of filteredRangeTasks) {
      if (!map[t.scheduledDate]) map[t.scheduledDate] = { total: 0, completed: 0 };
      map[t.scheduledDate].total += 1;
      if (t.isCompleted) map[t.scheduledDate].completed += 1;
    }
    return map;
  }, [filteredRangeTasks]);

  // NEW — Year density: walk each (already-filtered) yearly goal's real daily
  // descendants and bucket by the month they actually land in, instead of the
  // parent's own Jan-1 scheduledDate. Search/tag-aware because filteredGoals is.
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
    return () => { active = false; };
  }, [zoomLevel, filteredGoals]);

  const groupedSearchDailyTasks = useMemo(() => {
    const groups: Record<string, TaskRow[]> = {};
    for (const task of filteredRangeTasks) {
      if (!groups[task.scheduledDate]) groups[task.scheduledDate] = [];
      groups[task.scheduledDate].push(task);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRangeTasks]);

  const singleDayTasks = useMemo(
    () => filteredRangeTasks.filter((t) => t.scheduledDate === selectedDayStr),
    [filteredRangeTasks, selectedDayStr]
  );

  const navPrev = () => {
    setAnchorDate((d) => (zoomLevel === 'week' ? subWeeks(d, 1) : zoomLevel === 'month' ? subMonths(d, 1) : subYears(d, 1)));
  };
  const navNext = () => {
    setAnchorDate((d) => (zoomLevel === 'week' ? addWeeks(d, 1) : zoomLevel === 'month' ? addMonths(d, 1) : addYears(d, 1)));
  };
  const jumpToToday = () => {
    setAnchorDate(new Date());
    setSelectedDayStr(todayStr);
  };

  // Zoom OUT — tapping the period label itself
  const handleZoomOut = () => {
    if (zoomLevel === 'week') setZoomLevel('month');
    else if (zoomLevel === 'month') setZoomLevel('year');
  };

  // Zoom IN — year grid: tap a month. month grid: tap a week-number column.
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
    if (selectedDayStr !== todayStr) return;
    await toggleTask(taskId);
    await loadData();
  };

  const toggleSelectTask = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };
  const handleLongPressTask = (task: TaskRow) => {
    if (!selectionMode) { setSelectedIds([task.id]); setSelectionMode(true); }
  };
  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds([]); };
  const handleEditSelected = () => {
    if (selectedIds.length !== 1) return;
    const task = periodGoals.find((t) => t.id === selectedIds[0]) || periodRangeTasks.find((t) => t.id === selectedIds[0]);
    exitSelectionMode();
    if (!task) return;
    setSelectedTaskToEdit(task);
    if (task.scope === 'yearly') yearlyModalRef.current?.expand();
    else if (task.scope === 'monthly') monthlyModalRef.current?.expand();
    else if (task.scope === 'weekly') weeklyModalRef.current?.expand();
  };
  const handleBatchDelete = () => {
    Alert.alert('Delete Selected Items', `Delete ${selectedIds.length} item(s)? Subtasks and decomposition trees will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          for (const id of selectedIds) await deleteTaskCascade(id);
          exitSelectionMode();
          loadData();
        },
      },
    ]);
  };

  const activeModalRef = zoomLevel === 'week' ? weeklyModalRef : zoomLevel === 'month' ? monthlyModalRef : yearlyModalRef;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

        <View style={styles.stickyHeader}>
          {selectionMode ? (
            <View style={styles.selectionBar}>
              <Pressable onPress={exitSelectionMode} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
              <Text style={styles.selectionCountText}>{selectedIds.length} selected</Text>
              <View style={styles.selectionActions}>
                <Pressable onPress={() => setSelectedIds([...periodGoals, ...periodRangeTasks].map((t) => t.id))} hitSlop={8}>
                  <Ionicons name="checkbox-outline" size={22} color={colors.accent} />
                </Pressable>
                <Pressable onPress={handleEditSelected} disabled={selectedIds.length !== 1} hitSlop={8} style={selectedIds.length !== 1 && { opacity: 0.35 }}>
                  <Ionicons name="pencil-outline" size={22} color={selectedIds.length === 1 ? colors.accent : colors.textMuted} />
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
                    <Text style={styles.headerTitle} numberOfLines={1}>{headerLabel}</Text>
                  ) : (
                    <TouchableOpacity onPress={handleZoomOut} style={styles.headerTitlePressable} hitSlop={8}>
                      <Text style={styles.headerTitle} numberOfLines={1}>{headerLabel}</Text>
                      <Ionicons name="chevron-up-circle-outline" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                  {isEligibleForNote && (
                    <TouchableOpacity onPress={() => noteSheetRef.current?.expand()} hitSlop={8}>
                      <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => { setSelectedTaskToEdit(null); activeModalRef.current?.expand(); }}
                  style={styles.addBtn}
                >
                  <Ionicons name="add" size={20} color={colors.textOnAccent} />
                </TouchableOpacity>
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
          onToggleTag={(id) => setSelectedFilterTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))}
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
                  <Text key={`${day}-${idx}`} style={styles.weekLabelText}>{day}</Text>
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
                        <Text style={[styles.yearMonthName, isCurrent && styles.yearMonthNameCurrent]}>{format(monthDate, 'MMM')}</Text>
                        <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.textMuted} />
                      </View>
                      <View style={styles.yearProgressTrack}>
                        <View style={[styles.yearProgressFill, { width: count > 0 ? `${Math.round((completed / count) * 100)}%` : '0%' }]} />
                      </View>
                      <Text style={styles.yearFooterText}>
                        {count > 0 ? `${completed}/${count}${isFilterActive ? ' matching' : ''} tasks` : isFilterActive ? 'No matches' : 'No activity'}
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
                      <TouchableOpacity style={styles.weekNumCell} onPress={() => handleDrillToWeek(weekStartRowStr, weekDayStrs)}>
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
                          dotColor = stats.completed === stats.total ? colors.success : stats.completed > 0 ? colors.priorityMediumBorder : colors.priorityHighBorder;
                        }

                        return (
                          <TouchableOpacity
                            key={index}
                            style={[styles.monthDayCell, isSelected && styles.cellActive, isToday && styles.cellToday, isOutsideMonth && styles.cellMuted]}
                            onPress={() => setSelectedDayStr(dStr)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.cellNum, isOutsideMonth && styles.cellNumMuted, isSelected && styles.cellNumSelected]}>
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
                    dotColor = stats.completed === stats.total ? colors.success : stats.completed > 0 ? colors.priorityMediumBorder : colors.priorityHighBorder;
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

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderLine}>
              <Text style={styles.sectionHeaderTitle}>
                {zoomLevel === 'week' ? 'WEEKLY GOALS' : zoomLevel === 'month' ? 'MONTHLY GOALS' : 'YEARLY GOALS'}
              </Text>
              <Text style={styles.sectionItemCount}>{filteredGoals.length}</Text>
            </View>

            {filteredGoals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="flag-outline" size={20} color={colors.textMuted} style={{ opacity: 0.5 }} />
                <Text style={styles.emptyCardText}>{isFilterActive ? 'No matching goals.' : `No ${zoomLevel} goals set.`}</Text>
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
                  onPress={() => { if (selectionMode) toggleSelectTask(task.id); }}
                  onLongPress={() => handleLongPressTask(task)}
                />
              ))
            )}
          </View>

          {isFilterActive ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderLine}>
                <Text style={styles.sectionHeaderTitle}>MATCHING DAYS IN SCOPE</Text>
                <Text style={styles.sectionItemCount}>{filteredRangeTasks.length}</Text>
              </View>
              {groupedSearchDailyTasks.length === 0 ? (
                <Text style={styles.emptyNotice}>No daily tasks match your search in this {zoomLevel}.</Text>
              ) : (
                groupedSearchDailyTasks.map(([dateKey, tasksOnDay]) => (
                  <View key={dateKey} style={styles.dayGroupContainer}>
                    <View style={styles.dayGroupHeader}>
                      <Text style={styles.dayGroupTitle}>{format(parseISO(dateKey), 'EEEE, MMM d, yyyy')}</Text>
                      {zoomLevel === 'month' && (
                        <TouchableOpacity style={styles.drillWeekBtn} onPress={() => handleDrillToWeek(dateKey)}>
                          <Text style={styles.drillWeekBtnText}>Open Week</Text>
                          <Ionicons name="arrow-forward" size={12} color={colors.accent} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={{ gap: 8 }}>
                      {tasksOnDay.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task as any}
                          onToggle={() => { if (dateKey === todayStr) handleToggleTask(task.id); }}
                          onProgressChanged={loadData}
                          currentProgress={progressMap[task.id]}
                          pace={paceMap[task.id]}
                          subtaskCount={subtaskMap[task.id]}
                          isExpanded={Boolean(expandedTaskIds[task.id])}
                          onToggleExpand={() => setExpandedTaskIds((prev) => ({ ...prev, [task.id]: !prev[task.id] }))}
                          onSubtasksCountUpdate={(taskId, comp, tot) => setSubtaskMap((prev) => ({ ...prev, [taskId]: { completed: comp, total: tot } }))}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.includes(task.id)}
                          onLongPressCard={() => handleLongPressTask(task)}
                          onToggleSelect={() => toggleSelectTask(task.id)}
                        />
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : (
            zoomLevel !== 'year' && (
              <View style={styles.sectionBlock}>
                <View style={styles.dayFocusHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.sectionHeaderTitle}>{format(parseISO(selectedDayStr), 'EEEE, MMM d')}</Text>
                    {selectedDayStr === todayStr && (
                      <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>TODAY</Text></View>
                    )}
                  </View>
                  {zoomLevel === 'month' && (
                    <TouchableOpacity style={styles.drillWeekBtn} onPress={() => handleDrillToWeek(selectedDayStr)}>
                      <Text style={styles.drillWeekBtnText}>Open Week</Text>
                      <Ionicons name="arrow-forward" size={12} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>

                {singleDayTasks.length === 0 ? (
                  <Text style={styles.emptyNotice}>Nothing scheduled for this day.</Text>
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
                        onToggleExpand={() => setExpandedTaskIds((prev) => ({ ...prev, [task.id]: !prev[task.id] }))}
                        onSubtasksCountUpdate={(taskId, comp, tot) => setSubtaskMap((prev) => ({ ...prev, [taskId]: { completed: comp, total: tot } }))}
                        selectionMode={selectionMode}
                        isSelected={selectedIds.includes(task.id)}
                        onLongPressCard={() => handleLongPressTask(task)}
                        onToggleSelect={() => toggleSelectTask(task.id)}
                      />
                    ))}
                  </View>
                )}
              </View>
            )
          )}
        </ScrollView>

        <NewWeeklyTaskModal
          sheetRef={weeklyModalRef}
          weekStartDate={format(startOfWeek(anchorDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')}
          weekEndDate={format(endOfWeek(anchorDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')}
          editTask={zoomLevel === 'week' ? selectedTaskToEdit : null}
          onTaskCreated={loadData}
          onClose={() => setSelectedTaskToEdit(null)}
        />
        <NewMonthlyTaskModal
          sheetRef={monthlyModalRef}
          monthStartDate={format(startOfMonth(anchorDate), 'yyyy-MM-dd')}
          monthEndDate={format(endOfMonth(anchorDate), 'yyyy-MM-dd')}
          editTask={zoomLevel === 'month' ? selectedTaskToEdit : null}
          onTaskCreated={loadData}
          onClose={() => setSelectedTaskToEdit(null)}
        />
        <NewYearlyTaskModal
          sheetRef={yearlyModalRef}
          yearStartDate={format(startOfYear(anchorDate), 'yyyy-MM-dd')}
          yearEndDate={format(endOfYear(anchorDate), 'yyyy-MM-dd')}
          editTask={zoomLevel === 'year' ? selectedTaskToEdit : null}
          onTaskCreated={loadData}
          onClose={() => setSelectedTaskToEdit(null)}
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
          getSeed={() => generatePeriodSeed(zoomLevel === 'week' ? 'weekly' : zoomLevel === 'month' ? 'monthly' : 'yearly', startStr, endStr)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  stickyHeader: { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.borderSubtle, elevation: 2 },
  headerContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, marginRight: 10 },
  headerTitlePressable: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, flexShrink: 1 },
  addBtn: { backgroundColor: colors.accent, width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  navBtn: { padding: 4 },
  todayBtnText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  selectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  selectionCountText: { fontSize: 15, color: colors.textPrimary, fontWeight: '700' },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 60 },
  matrixWrapper: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSubtle, padding: 10, marginBottom: 16 },
  weekLabelsRow: { flexDirection: 'row', marginBottom: 6, paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
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
  yearMonthCard: { width: '31%', backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.borderSubtle, padding: 10, gap: 6 },
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
  emptyCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, borderStyle: 'dashed', padding: 20, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyCardText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  emptyNotice: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', paddingVertical: 8 },
  dayFocusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  todayBadge: { backgroundColor: colors.accent, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  todayBadgeText: { fontSize: 9, fontWeight: '800', color: colors.textOnAccent },
  drillWeekBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  drillWeekBtnText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  dayGroupContainer: { marginBottom: 14 },
  dayGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
  dayGroupTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
});