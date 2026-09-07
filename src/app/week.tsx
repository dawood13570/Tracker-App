import { ActivityCard } from '@/components/ActivityCard';
import { EventCard } from '@/components/EventCard';
import { GoalCard } from '@/components/GoalCard';
import { HabitCard } from '@/components/HabitCard';
import NewTaskModal from '@/components/new-task';
import NewActivityModal from '@/components/NewActivityModal';
import NewEventModal from '@/components/NewEventModal';
import NewHabitModal from '@/components/NewHabitModal';
import NewWeeklyTaskModal from '@/components/NewWeeklyTaskModel';
import ProgressLogSheet from '@/components/ProgressLogSheet';
import { TagFilterBar } from '@/components/TagFilterBar';
import { TaskCard } from '@/components/TaskCard';
import {
  deleteTaskCascade,
  EventRow,
  getActivityLogsForDateRange,
  getAllTagAssociations,
  getCurrentProgress,
  getEffectiveProgress,
  getEventsForDateRange,
  getHabitsByDate,
  getProgressLogsByTask,
  getSubtaskCounts,
  getTasksForDateRange,
  getWeeklyTasks,
  HabitWithStatus,
  TaskRow,
  updateTask
} from '@/db/queries';
import { calculatePace, PaceResult } from '@/engine/pace';
import { ActivityLogWithDetails, useActivityStore } from '@/store/activityStore';
import { useEventStore } from '@/store/eventStore';
import { useHabitStore } from '@/store/habitStore';
import { useTagStore } from '@/store/tagStore';
import { useTaskStore } from '@/store/taskStore';
import { colors } from '@/theme/colors';
import { getLocalDateString } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { addDays, endOfWeek, format, isSameDay, parseISO, startOfWeek, subDays } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

type ItemType = 'task' | 'habit' | 'event' | 'activity';

export default function WeekScreen() {
  const [currentPivotDate, setCurrentPivotDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);

  // Entities
  const [weekTasks, setWeekTasks] = useState<TaskRow[]>([]);
  const [dailyTasks, setDailyTasks] = useState<TaskRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [activities, setActivities] = useState<ActivityLogWithDetails[]>([]);

  // Progression & Hybrid maps for cards
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [paceMap, setPaceMap] = useState<Record<number, PaceResult>>({});
  const [subtaskMap, setSubtaskMap] = useState<Record<number, { completed: number; total: number }>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({});

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<number[]>([]);
  const [strictTagFilter, setStrictTagFilter] = useState<boolean>(false);
  const [tagAssociations, setTagAssociations] = useState<{
    tasks: Record<number, number[]>;
    habits: Record<number, number[]>;
    events: Record<number, number[]>;
    activities: Record<number, number[]>;
  }>({ tasks: {}, habits: {}, events: {}, activities: {} });


  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit modals state
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [loggingTask, setLoggingTask] = useState<TaskRow | null>(null);
  const [editingHabit, setEditingHabit] = useState<HabitWithStatus | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLogWithDetails | null>(null);
  const [activeDayStr, setActiveDayStr] = useState<string>(getLocalDateString(new Date()));
  const [editingWeeklyGoal, setEditingWeeklyGoal] = useState<TaskRow | null>(null);

  // BottomSheet Refs
  const taskEditSheetRef = useRef<BottomSheet>(null);
  const progressSheetRef = useRef<BottomSheet>(null);
  const habitEditSheetRef = useRef<BottomSheet>(null);
  const eventEditSheetRef = useRef<BottomSheet>(null);
  const activityModalSheetRef = useRef<BottomSheet>(null);
  const newWeeklySheetRef = useRef<BottomSheet>(null);

  // Stores
  const { toggleTask, removeTask } = useTaskStore();
  const { removeHabit, logHabit } = useHabitStore();
  const { removeEvent } = useEventStore();
  const { removeActivityEntry } = useActivityStore();
  const { tags: allTags, loadTags, loadMostUsedTags, tagVersion } = useTagStore();

  const weekStart = useMemo(() => startOfWeek(currentPivotDate, { weekStartsOn: 1 }), [currentPivotDate]);
  const weekEnd = useMemo(() => endOfWeek(currentPivotDate, { weekStartsOn: 1 }), [currentPivotDate]);
  const weekStartStr = useMemo(() => getLocalDateString(weekStart), [weekStart]);
  const weekEndStr = useMemo(() => getLocalDateString(weekEnd), [weekEnd]);
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const daysOfCurrentWeek = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const refreshTagMap = useCallback(async () => {
    const map = await getAllTagAssociations();
    setTagAssociations(map);
  }, []);

  const loadWeekData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [weekly, dailies, evts, rawHabits, rawActivityLogs] = await Promise.all([
        getWeeklyTasks(weekStartStr, weekEndStr),
        getTasksForDateRange(weekStartStr, weekEndStr),
        getEventsForDateRange(weekStartStr, weekEndStr),
        getHabitsByDate(todayStr),
        getActivityLogsForDateRange(weekStartStr, weekEndStr),
        loadTags(),
        loadMostUsedTags(),
        refreshTagMap(),
      ]);

      setWeekTasks(weekly);
      setDailyTasks(dailies);
      setEvents(evts);
      setHabits(rawHabits);
      setActivities(rawActivityLogs);

    } catch (error) {
      console.error('Failed to load week data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [weekStartStr, weekEndStr, todayStr, loadTags, loadMostUsedTags, refreshTagMap]);

  useFocusEffect(
    useCallback(() => {
      loadWeekData();
    }, [loadWeekData])
  );

  useEffect(() => {
    refreshTagMap();
  }, [tagVersion, refreshTagMap]);

  useEffect(() => {
  const allActiveTasks = [...weekTasks, ...dailyTasks];
  const progressionTasks = allActiveTasks.filter((t) => t.type === 'Progression');
  if (progressionTasks.length === 0) {
    setProgressMap({});
    setPaceMap({});
    return;
  }
  Promise.all(
    progressionTasks.map(async (t) => {
      const currentProgress = t.scope === 'daily' ? await getCurrentProgress(t.id) : await getEffectiveProgress(t.id);
      const logs = await getProgressLogsByTask(t.id);
      const pace = calculatePace({ ...t, currentProgress }, logs);
      return [t.id, currentProgress, pace] as const;
    })
  ).then((entries) => {
    setProgressMap(Object.fromEntries(entries.map(([id, cp]) => [id, cp])));
    setPaceMap(Object.fromEntries(entries.map(([id, , pace]) => [id, pace])));
  });
}, [weekTasks, dailyTasks]);

  useEffect(() => {
    const allActiveTasks = [...weekTasks, ...dailyTasks];
    const hybridTasks = allActiveTasks.filter((t) => t.type === 'Hybrid');
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
  }, [weekTasks, dailyTasks]);



  const handleToggleFilterTag = (tagId: number) => {
    setSelectedFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleToggleExpand = (taskId: number) => {
    setExpandedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleOpenProgressLog = (task: TaskRow) => {
    setLoggingTask(task);
    progressSheetRef.current?.expand();
  };

  const handleSubtasksCountUpdate = (taskId: number, completed: number, total: number) => {
    setSubtaskMap((prev) => ({ ...prev, [taskId]: { completed, total } }));
  };

  const handleToggleTaskWithAutofill = async (taskId: number, currentStatus: boolean) => {
    const targetTask = [...weekTasks, ...dailyTasks].find((t) => t.id === taskId);
    if (!targetTask) return;

    if (targetTask.type === 'Progression' && !currentStatus && targetTask.totalProgress) {
      await updateTask(taskId, { isCompleted: true });
    } else {
      await toggleTask(taskId);
    }
    await loadWeekData();
  };

  const filterItem = useCallback(
    <T extends { id: number; title: string }>(
      items: T[],
      idMap: Record<number, number[]>
    ): T[] => {
      const q = searchQuery.trim().toLowerCase();

      return items
        .filter((item) => {
          const matchesText = !q || item.title.toLowerCase().includes(q);
          const itemTags = idMap[item.id] ?? [];
          const matchesTags =
            selectedFilterTagIds.length === 0 ||
            selectedFilterTagIds.some((selected) => itemTags.includes(selected));

          if (selectedFilterTagIds.length > 0 && strictTagFilter) {
            return matchesText && matchesTags;
          }

          return matchesText && matchesTags;
        })
        .sort((a, b) => {
          if (selectedFilterTagIds.length > 0 && !strictTagFilter) {
            const matchA = selectedFilterTagIds.some((s) => (idMap[a.id] ?? []).includes(s)) ? 1 : 0;
            const matchB = selectedFilterTagIds.some((s) => (idMap[b.id] ?? []).includes(s)) ? 1 : 0;
            return matchB - matchA;
          }
          return 0;
        });
    },
    [searchQuery, selectedFilterTagIds, strictTagFilter]
  );

  const filteredWeekTasks = useMemo(
    () => filterItem(weekTasks, tagAssociations.tasks),
    [weekTasks, tagAssociations.tasks, filterItem]
  );

  const filteredDailyTasks = useMemo(
    () => filterItem(dailyTasks, tagAssociations.tasks),
    [dailyTasks, tagAssociations.tasks, filterItem]
  );

  const filteredEvents = useMemo(
    () => filterItem(events, tagAssociations.events),
    [events, tagAssociations.events, filterItem]
  );

  const filteredHabits = useMemo(
    () => filterItem(habits, tagAssociations.habits),
    [habits, tagAssociations.habits, filterItem]
  );

  const activitiesForFilter = useMemo(
    () => activities.map((e) => ({ ...e, title: e.activityTitle })),
    [activities]
  );

  const activitiesTagMap = useMemo(
    () => Object.fromEntries(activities.map((e) => [e.id, e.tagIds])),
    [activities]
  );

  const filteredActivities = useMemo(
    () => filterItem(activitiesForFilter, activitiesTagMap),
    [activitiesForFilter, activitiesTagMap, filterItem]
  );

  const isFilteringActive = Boolean(searchQuery.trim()) || selectedFilterTagIds.length > 0;

  const handleLongPressItem = (type: ItemType, id: number) => {
    setSelectionMode(true);
    setSelectedIds(new Set([`${type}:${id}`]));
  };

  const handleToggleSelectItem = (type: ItemType, id: number) => {
    setSelectedIds((prev) => {
      const key = `${type}:${id}`;
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleSelectAll = () => {
    const all = new Set<string>();
    filteredDailyTasks.forEach((t) => all.add(`task:${t.id}`));
    filteredWeekTasks.forEach((t) => all.add(`task:${t.id}`));
    filteredHabits.forEach((h) => all.add(`habit:${h.id}`));
    filteredEvents.forEach((e) => all.add(`event:${e.id}`));
    filteredActivities.forEach((a) => all.add(`activity:${a.id}`));
    setSelectedIds(all);
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    Alert.alert('Delete Selected Items', `Delete ${count} item${count > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          for (const key of selectedIds) {
            const [type, rawId] = key.split(':') as [ItemType, string];
            const id = Number(rawId);
            if (type === 'task') await deleteTaskCascade(id);
            if (type === 'habit') await removeHabit(id);
            if (type === 'event') await removeEvent(id);
            if (type === 'activity') {
              const act = activities.find((a) => a.id === id);
              if (act) await removeActivityEntry(id, act.date);
            }
          }
          handleCancelSelection();
          await loadWeekData();
        },
      },
    ]);
  };

  const handleBulkEdit = () => {
    if (selectedIds.size !== 1) return;
    const [key] = [...selectedIds];
    const [type, rawId] = key.split(':') as [ItemType, string];
    const id = Number(rawId);

    handleCancelSelection();

    if (type === 'task') {
  const task = dailyTasks.find((t) => t.id === id) || weekTasks.find((t) => t.id === id);
  if (task) {
    if (task.scope === 'weekly') {
      setEditingWeeklyGoal(task);
      newWeeklySheetRef.current?.expand();
    } else {
      setEditingTask(task);
      taskEditSheetRef.current?.expand();
    }
  }
} else if (type === 'habit') {
      const habit = habits.find((h) => h.id === id);
      if (habit) {
        setEditingHabit(habit);
        habitEditSheetRef.current?.expand();
      }
    } else if (type === 'event') {
      const event = events.find((e) => e.id === id);
      if (event) {
        setEditingEvent(event);
        eventEditSheetRef.current?.expand();
      }
    } else if (type === 'activity') {
      const act = activities.find((a) => a.id === id);
      if (act) {
        setSelectedActivity(act);
        activityModalSheetRef.current?.expand();
      }
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

        <View style={styles.stickyHeader}>
          {selectionMode ? (
            <View style={styles.selectionBar}>
              <Pressable onPress={handleCancelSelection} hitSlop={10} style={styles.cancelBtn}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>

              <Text style={styles.selectionCountText}>{selectedIds.size} selected</Text>

              <View style={styles.selectionActions}>
                <Pressable onPress={handleSelectAll} hitSlop={8} style={styles.iconActionBtn}>
                  <Ionicons name="checkbox-outline" size={22} color={colors.accent} />
                </Pressable>

                <Pressable
                  onPress={handleBulkEdit}
                  disabled={selectedIds.size !== 1}
                  hitSlop={8}
                  style={[styles.iconActionBtn, selectedIds.size !== 1 && styles.actionDisabled]}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={22}
                    color={selectedIds.size === 1 ? colors.accent : colors.textMuted}
                  />
                </Pressable>

                <Pressable onPress={handleBulkDelete} hitSlop={8} style={styles.iconActionBtn}>
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <Text style={styles.headerTitle}>Weekly Plan</Text>
                <TouchableOpacity
                  style={styles.addWeeklyBtn}
                  onPress={() => newWeeklySheetRef.current?.expand()}
                >
                  <Ionicons name="add" size={18} color={colors.textOnAccent} />
                  <Text style={styles.addWeeklyBtnText}>Plan Task</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={() => setCurrentPivotDate((d) => subDays(d, 7))} style={styles.navBtn}>
                  <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setCurrentPivotDate(new Date())}>
                  <Text style={styles.rangeText}>
                    {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setCurrentPivotDate((d) => addDays(d, 7))} style={styles.navBtn}>
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
          onToggleTag={handleToggleFilterTag}
          onClearAllTags={() => setSelectedFilterTagIds([])}
          strictOnly={strictTagFilter}
          onToggleStrictOnly={setStrictTagFilter}
        />

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {filteredWeekTasks.length > 0 }

            {/* Day strip */}
<View style={styles.dayStripRow}>
  {daysOfCurrentWeek.map((day) => {
    const dayStr = getLocalDateString(day);
    const isToday = isSameDay(day, new Date());
    const isSelected = dayStr === activeDayStr;
    const dayTasks = filteredDailyTasks.filter((t) => t.scheduledDate === dayStr);
    const total = dayTasks.length;
    const completed = dayTasks.filter((t) => t.isCompleted).length;
    let dotColor = 'transparent';
    if (total > 0) dotColor = completed === total ? colors.success : completed > 0 ? colors.priorityMediumBorder : colors.priorityHighBorder;

    return (
      <TouchableOpacity
        key={dayStr}
        style={[styles.dayStripCell, isSelected && styles.dayStripCellSelected, isToday && styles.dayStripCellToday]}
        onPress={() => setActiveDayStr(dayStr)}
      >
        <Text style={styles.dayStripLabel}>{format(day, 'EEE')}</Text>
        <Text style={styles.dayStripNumber}>{format(day, 'd')}</Text>
        <View style={[styles.dayStripDot, { backgroundColor: dotColor }]} />
      </TouchableOpacity>
    );
  })}
</View>

{/* This Week's Goals */}
<View style={styles.weeklySpanningBox}>
  <View style={styles.sectionHeaderRow}>
    <Text style={styles.sectionHeader}>THIS WEEK'S GOALS</Text>
  </View>
  {filteredWeekTasks.length === 0 ? (
    <Text style={styles.emptyDayText}>No weekly goals set.</Text>
  ) : (
    filteredWeekTasks.map((task) => (
      <GoalCard
        key={task.id}
        task={task}
        scopeLabel="week"
        effectiveProgress={progressMap[task.id]}
        selectionMode={selectionMode}
        isSelected={selectedIds.has(`task:${task.id}`)}
        onPress={() => {
          if (selectionMode) {
            handleToggleSelectItem('task', task.id);
          } else {
            setEditingWeeklyGoal(task);
            newWeeklySheetRef.current?.expand();
          }
        }}
        onLongPress={() => handleLongPressItem('task', task.id)}
      />
    ))
  )}
</View>

{/* Schedule for the selected day */}
<View style={styles.dayCard}>
  <Text style={[styles.dayTitleText, { padding: 12 }]}>{format(parseISO(activeDayStr), 'EEEE, MMM d')}</Text>
  <View style={styles.expandedContent}>
    {(() => {
      const eventsForDay = filteredEvents.filter((e) => e.startTime.startsWith(activeDayStr));
      const tasksForDay = filteredDailyTasks.filter((t) => t.scheduledDate === activeDayStr);
      const isToday = activeDayStr === todayStr;
      const habitsForDay = isToday ? filteredHabits : [];
      const activitiesForDay = filteredActivities.filter((a) => a.date === activeDayStr);
      const isPast = activeDayStr < todayStr;

      if (!eventsForDay.length && !tasksForDay.length && !habitsForDay.length && !activitiesForDay.length) {
        return <Text style={styles.emptyDayText}>Nothing scheduled for this day.</Text>;
      }

      return (
        <>
          {eventsForDay.map((event) => (
            <EventCard key={`event-${event.id}`} event={event} selectionMode={selectionMode} isSelected={selectedIds.has(`event:${event.id}`)} onLongPressCard={() => handleLongPressItem('event', event.id)} onToggleSelect={() => handleToggleSelectItem('event', event.id)} />
          ))}
          {tasksForDay.map((task) => (
            <TaskCard
              key={`task-${task.id}`}
              task={task as any}
              onToggle={async (id, status) => { if (!isPast) await handleToggleTaskWithAutofill(id, status); }}
              onProgressChanged={loadWeekData}
              currentProgress={progressMap[task.id]}
              pace={paceMap[task.id]}
              subtaskCount={subtaskMap[task.id]}
              isExpanded={Boolean(expandedTaskIds[task.id])}
              onToggleExpand={() => handleToggleExpand(task.id)}
              onSubtasksCountUpdate={handleSubtasksCountUpdate}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(`task:${task.id}`)}
              onLongPressCard={() => handleLongPressItem('task', task.id)}
              onToggleSelect={() => handleToggleSelectItem('task', task.id)}
            />
          ))}
          {isToday && habitsForDay.map((habit) => (
            <HabitCard key={`habit-${habit.id}`} habit={habit} onLogToday={async () => { await logHabit(habit.id); await loadWeekData(); }} selectionMode={selectionMode} isSelected={selectedIds.has(`habit:${habit.id}`)} onLongPressCard={() => handleLongPressItem('habit', habit.id)} onToggleSelect={() => handleToggleSelectItem('habit', habit.id)} />
          ))}
          {activitiesForDay.map((entry) => (
            <ActivityCard key={`act-${entry.id}`} entry={entry} tags={allTags.filter((t) => entry.tagIds.includes(t.id))} selectionMode={selectionMode} isSelected={selectedIds.has(`activity:${entry.id}`)} onPressCard={() => { setSelectedActivity(entry); activityModalSheetRef.current?.expand(); }} onLongPressCard={() => handleLongPressItem('activity', entry.id)} onToggleSelect={() => handleToggleSelectItem('activity', entry.id)} />
          ))}
        </>
      );
    })()}
  </View>
</View>
          </ScrollView>
        )}

        <NewTaskModal
          sheetRef={taskEditSheetRef}
          taskToEdit={editingTask as any}
          onTaskCreated={loadWeekData}
          onClose={() => setEditingTask(null)}
        />

        <NewHabitModal
          sheetRef={habitEditSheetRef}
          habitToEdit={editingHabit}
          onHabitCreated={loadWeekData}
          onClose={() => setEditingHabit(null)}
        />

        <NewEventModal
          sheetRef={eventEditSheetRef}
          eventToEdit={editingEvent}
          onEventCreated={loadWeekData}
          onClose={() => setEditingEvent(null)}
        />

        <NewActivityModal
          sheetRef={activityModalSheetRef}
          entry={selectedActivity}
          onActivityCreated={loadWeekData}
          onClose={() => setSelectedActivity(null)}
        />

        <NewWeeklyTaskModal
          sheetRef={newWeeklySheetRef}
          weekStartDate={weekStartStr}
          weekEndDate={weekEndStr}
          editTask={editingWeeklyGoal}
          onTaskCreated={loadWeekData}
          onClose={() => setEditingWeeklyGoal(null)}
        />

        <ProgressLogSheet
          sheetRef={progressSheetRef}
          task={loggingTask}
          currentProgress={loggingTask ? progressMap[loggingTask.id] ?? 0 : 0}
          pace={loggingTask ? paceMap[loggingTask.id] : undefined}
          onLogged={loadWeekData}
          onClose={() => setLoggingTask(null)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  stickyHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  headerContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  addWeeklyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  addWeeklyBtnText: { color: colors.textOnAccent, fontSize: 13, fontWeight: '700' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  navBtn: { padding: 4 },
  rangeText: { fontSize: 14, fontWeight: '700', color: colors.accent },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cancelBtn: { padding: 4 },
  selectionCountText: { fontSize: 16, color: colors.textPrimary, fontWeight: '600' },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  iconActionBtn: { padding: 4 },
  actionDisabled: { opacity: 0.35 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  weeklySpanningBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionHeader: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 8 },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  dayCardToday: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  dayCardPast: {
    opacity: 0.75,
    borderColor: colors.borderSubtle,
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dayTitlePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dayTitleText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  dayTitleToday: { color: colors.accent },
  dayTitlePast: { color: colors.textMuted },
  todayPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayPillText: { fontSize: 9, fontWeight: '800', color: colors.textOnAccent },
  pastPill: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pastPillText: { fontSize: 9, fontWeight: '700', color: colors.textMuted },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  taskBadge: {
    backgroundColor: colors.hybridBadgeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  taskBadgeText: { fontSize: 11, fontWeight: '700', color: colors.hybridBadgeText },
  badgeMuted: {
    backgroundColor: colors.surfaceSubtle,
  },
  badgeTextMuted: {
    color: colors.textMuted,
  },
  eventBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  eventBadgeText: { fontSize: 11, fontWeight: '600', color: colors.eventAccent },
  chevronBtn: { padding: 4 },
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  emptyDayText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
    textAlign: 'center',
  },
  dayStripRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: colors.borderSubtle, marginBottom: 16 },
dayStripCell: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
dayStripCellSelected: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accent },
dayStripCellToday: { backgroundColor: colors.surfaceSubtle },
dayStripLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
dayStripNumber: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
dayStripDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
});

