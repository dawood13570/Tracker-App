import { AddType } from '@/components/AddTypeSwitcher';
import { EventCard } from '@/components/EventCard';
import NewTaskModal from '@/components/new-task';
import NewActivityModal from '@/components/NewActivityModal';
import NewEventModal from '@/components/NewEventModal';
import NewHabitModal from '@/components/NewHabitModal';
import ProgressLogSheet from '@/components/ProgressLogSheet';
import { TagFilterBar } from '@/components/TagFilterBar';
import { TaskCard } from '@/components/TaskCard';
import {
  getAllTagAssociations,
  getCurrentProgress,
  getProgressLogsByTask,
  getSubtaskCounts,
} from '@/db/queries';
import { calculatePace, PaceResult } from '@/engine/pace';
import { getEffectivePriority, shouldArchiveTask } from '@/engine/priority';
import { ActivityWithLastLog, useActivityStore } from '@/store/activityStore';
import { EventRow, useEventStore } from '@/store/eventStore';
import { HabitWithStatus, useHabitStore } from '@/store/habitStore';
import { useTagStore } from '@/store/tagStore';
import { Task, useTaskStore } from '@/store/taskStore';
import { useStore } from '@/store/useStore';
import { runRolloverNow } from '@/tasks/rolloverTask';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityCard } from '../components/ActivityCard';
import { HabitCard } from '../components/HabitCard';

const PRIORITY_WEIGHT: Record<string, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

type ItemType = 'task' | 'habit' | 'event' | 'activity';

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
  const eventSheetRef = useRef<BottomSheet>(null);
  const newActivitySheetRef = useRef<BottomSheet>(null);
  const activityDetailSheetRef = useRef<BottomSheet>(null);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loggingTask, setLoggingTask] = useState<Task | null>(null);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [paceMap, setPaceMap] = useState<Record<number, PaceResult>>({});
  const [subtaskMap, setSubtaskMap] = useState<Record<number, { completed: number; total: number }>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({});
  const [editingHabit, setEditingHabit] = useState<HabitWithStatus | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithLastLog | null>(null);

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

  const { tasks, isLoading, loadTasks, toggleTask, removeTask } = useTaskStore();
  const { evolvingPriorityEnabled, autoArchiveEnabled } = useStore();
  const { habits, loadHabits, logHabit, removeHabit } = useHabitStore();
  const { events, loadEvents, removeEvent } = useEventStore();
  const { activities, loadActivities, removeActivity, quickLog } = useActivityStore();
  const { loadTags, loadMostUsedTags, tagVersion } = useTagStore();

  const handleSwitchAddType = (type: AddType) => {
    taskSheetRef.current?.close();
    habitSheetRef.current?.close();
    eventSheetRef.current?.close();
    newActivitySheetRef.current?.close();
    setEditingTask(null);
    setEditingHabit(null);
    setEditingEvent(null);

    setTimeout(() => {
      if (type === 'Task') taskSheetRef.current?.expand();
      if (type === 'Habit') habitSheetRef.current?.expand();
      if (type === 'Event') eventSheetRef.current?.expand();
      if (type === 'Activity') newActivitySheetRef.current?.expand();
    }, 150);
  };

  const refreshTagMap = useCallback(async () => {
    const map = await getAllTagAssociations();
    setTagAssociations(map);
  }, []);

  useEffect(() => {
    const catchUpAndLoad = async () => {
      await runRolloverNow();
      await Promise.all([
        loadTasks(),
        loadHabits(),
        loadEvents(),
        loadActivities(),
        loadTags(),
        loadMostUsedTags(),
        refreshTagMap(),
      ]);
    };

    catchUpAndLoad();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadTasks();
        loadHabits();
        loadEvents();
        loadActivities();
        refreshTagMap();
      }
    });

    return () => subscription.remove();
  }, [loadTags, loadMostUsedTags, loadTasks, loadHabits, loadEvents, loadActivities, refreshTagMap]);

  useEffect(() => {
    refreshTagMap();
  }, [tagVersion, refreshTagMap]);

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
    setExpandedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleToggleTask = async (id: number) => {
    await toggleTask(id);
  };

  const handleSubtasksCountUpdate = (taskId: number, completed: number, total: number) => {
    setSubtaskMap((prev) => ({ ...prev, [taskId]: { completed, total } }));
  };

  const handleToggleFilterTag = (tagId: number) => {
    setSelectedFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

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
      return (PRIORITY_WEIGHT[effectiveB] || 0) - (PRIORITY_WEIGHT[effectiveA] || 0);
    });
  }, [tasks, evolvingPriorityEnabled]);

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

  const filteredTasks = useMemo(
    () => filterItem(sortedTasks, tagAssociations.tasks),
    [sortedTasks, tagAssociations.tasks, filterItem]
  );

  const { visibleTasks, archivedCount } = useMemo(() => {
    let list = filteredTasks;

    if (autoArchiveEnabled && selectedFilterTagIds.length === 0 && !searchQuery.trim()) {
      const archiveInputs = tasks.map((t) => ({
        id: t.id,
        priority: t.priority,
        procrastinationCount: t.procrastinationCount ?? 0,
      }));

      list = filteredTasks.filter((t) => {
        if (t.isCompleted) return true;
        const input = { id: t.id, priority: t.priority, procrastinationCount: t.procrastinationCount ?? 0 };
        return !shouldArchiveTask(input, archiveInputs);
      });
    }

    return { visibleTasks: list, archivedCount: sortedTasks.length - list.length };
  }, [filteredTasks, sortedTasks, tasks, autoArchiveEnabled, selectedFilterTagIds.length, searchQuery]);

  const filteredEvents = useMemo(
    () => filterItem(events, tagAssociations.events),
    [events, tagAssociations.events, filterItem]
  );

  const filteredHabits = useMemo(
    () => filterItem(habits, tagAssociations.habits),
    [habits, tagAssociations.habits, filterItem]
  );

  const filteredActivities = useMemo(
    () => filterItem(activities, tagAssociations.activities),
    [activities, tagAssociations.activities, filterItem]
  );

  const handleSelectAll = () => {
    const all = new Set<string>();
    visibleTasks.forEach((t) => all.add(`task:${t.id}`));
    filteredHabits.forEach((h) => all.add(`habit:${h.id}`));
    filteredEvents.forEach((e) => all.add(`event:${e.id}`));
    filteredActivities.forEach((a) => all.add(`activity:${a.id}`));
    setSelectedIds(all);
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    Alert.alert(
      'Delete Selected Items',
      `Delete ${count} item${count > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const key of selectedIds) {
              const [type, rawId] = key.split(':') as [ItemType, string];
              const id = Number(rawId);
              if (type === 'task') await removeTask(id);
              if (type === 'habit') await removeHabit(id);
              if (type === 'event') await removeEvent(id);
              if (type === 'activity') await removeActivity(id);
            }
            handleCancelSelection();
            await refreshTagMap();
          },
        },
      ]
    );
  };

  const handleBulkEdit = () => {
    if (selectedIds.size !== 1) return;
    const [key] = [...selectedIds];
    const [type, rawId] = key.split(':') as [ItemType, string];
    const id = Number(rawId);

    handleCancelSelection();

    if (type === 'task') {
      const task = tasks.find((t) => t.id === id);
      if (task) handleEditTask(task);
    } else if (type === 'habit') {
      const habit = habits.find((h) => h.id === id);
      if (habit) {
        setEditingHabit(habit);
        habitSheetRef.current?.expand();
      }
    } else if (type === 'event') {
      const event = events.find((e) => e.id === id);
      if (event) {
        setEditingEvent(event);
        eventSheetRef.current?.expand();
      }
    }
  };

  const listExtraData = useMemo(() => {
    return {
      selectionMode,
      selectedIdsSize: selectedIds.size,
      selectedIdsString: Array.from(selectedIds).join(','),
      habitsState: filteredHabits.map((h) => `${h.id}:${h.isCompletedToday}:${h.streak}`).join(','),
      eventsCount: filteredEvents.length,
      activitiesState: filteredActivities.map((a) => `${a.id}:${a.lastLog?.date}`).join(','),
      expandedTaskIds,
      progressMap,
      paceMap,
      subtaskMap,
      searchQuery,
      selectedFilterTagIds: selectedFilterTagIds.join(','),
      strictTagFilter,
    };
  }, [
    selectionMode,
    selectedIds,
    filteredHabits,
    filteredEvents.length,
    filteredActivities,
    expandedTaskIds,
    progressMap,
    paceMap,
    subtaskMap,
    searchQuery,
    selectedFilterTagIds,
    strictTagFilter,
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

        {/* Sticky Header swaps title area only */}
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
            <DateHeader />
          )}
        </View>

        {/* TagFilterBar remains permanently mounted so layout never shifts */}
        <TagFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTagIds={selectedFilterTagIds}
          onToggleTag={handleToggleFilterTag}
          onClearAllTags={() => setSelectedFilterTagIds([])}
          strictOnly={strictTagFilter}
          onToggleStrictOnly={setStrictTagFilter}
        />

        <View style={{ flex: 1 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#1c8db9" style={{ marginTop: 40 }} />
          ) : (
            <>
              {archivedCount > 0 && selectedFilterTagIds.length === 0 && !searchQuery.trim() && (
                <View style={styles.archiveBanner}>
                  <Text style={styles.archiveBannerText}>
                    {archivedCount} task{archivedCount > 1 ? 's' : ''} archived until an overdue task is done
                  </Text>
                </View>
              )}
              <FlashList
                ref={flashListRef}
                data={visibleTasks}
                keyExtractor={(item) => `task-${item.id}`}
                extraData={listExtraData}
                removeClippedSubviews={false}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <TaskCard
                    task={item}
                    onToggle={handleToggleTask}
                    currentProgress={progressMap[item.id]}
                    pace={paceMap[item.id]}
                    subtaskCount={subtaskMap[item.id]}
                    isExpanded={Boolean(expandedTaskIds[item.id])}
                    onToggleExpand={() => handleToggleExpand(item.id)}
                    onOpenProgressLog={handleOpenProgressLog}
                    onSubtasksCountUpdate={handleSubtasksCountUpdate}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(`task:${item.id}`)}
                    onLongPressCard={() => handleLongPressItem('task', item.id)}
                    onToggleSelect={() => handleToggleSelectItem('task', item.id)}
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      {searchQuery.trim() || selectedFilterTagIds.length > 0
                        ? 'No matching items found.'
                        : 'Nothing to do today.'}
                    </Text>
                    <Text style={styles.emptyStateSubtext}>
                      {searchQuery.trim() || selectedFilterTagIds.length > 0
                        ? 'Try clearing your search or filters.'
                        : 'Tap + to add task.'}
                    </Text>
                  </View>
                }
                ListHeaderComponent={
                  filteredEvents.length > 0 || filteredHabits.length > 0 || filteredActivities.length > 0 ? (
                    <View style={{ marginBottom: 8 }} collapsable={false}>
                      {filteredEvents.map((event) => (
                        <EventCard
                          key={`event-${event.id}`}
                          event={event}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.has(`event:${event.id}`)}
                          onLongPressCard={() => handleLongPressItem('event', event.id)}
                          onToggleSelect={() => handleToggleSelectItem('event', event.id)}
                        />
                      ))}
                      {filteredHabits.map((habit) => (
                        <HabitCard
                          key={`habit-${habit.id}`}
                          habit={habit}
                          onLogToday={logHabit}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.has(`habit:${habit.id}`)}
                          onLongPressCard={() => handleLongPressItem('habit', habit.id)}
                          onToggleSelect={() => handleToggleSelectItem('habit', habit.id)}
                        />
                      ))}
                      {filteredActivities.map((act) => (
                        <ActivityCard
                          key={`activity-${act.id}`}
                          activity={act}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.has(`activity:${act.id}`)}
                          onPressCard={() => {
                            setSelectedActivity(act);
                            activityDetailSheetRef.current?.expand();
                          }}
                          onLongPressCard={() => handleLongPressItem('activity', act.id)}
                          onToggleSelect={() => handleToggleSelectItem('activity', act.id)}
                          onQuickLog={() => quickLog(act.id)}
                        />
                      ))}
                    </View>
                  ) : null
                }
              />
            </>
          )}
        </View>

        {!selectionMode && (
          <Pressable
            onPress={() => {
              setEditingTask(null);
              taskSheetRef.current?.expand();
            }}
            style={({ pressed }) => [
              styles.buttonStuff,
              { backgroundColor: pressed ? colors.accentPressed : colors.accent },
            ]}
          >
            <Text style={styles.buttonText}>+</Text>
          </Pressable>
        )}

        <NewHabitModal
          sheetRef={habitSheetRef}
          onHabitCreated={async () => {
            await loadHabits();
            await refreshTagMap();
          }}
          habitToEdit={editingHabit}
          onClose={() => setEditingHabit(null)}
          onSwitchType={handleSwitchAddType}
        />

        <NewTaskModal
          sheetRef={taskSheetRef}
          onTaskCreated={async () => {
            await loadTasks();
            await refreshTagMap();
          }}
          taskToEdit={editingTask}
          onClose={() => setEditingTask(null)}
          onSwitchType={handleSwitchAddType}
        />

        <NewEventModal
          sheetRef={eventSheetRef}
          onEventCreated={async () => {
            await loadEvents();
            await refreshTagMap();
          }}
          eventToEdit={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSwitchType={handleSwitchAddType}
        />

        <NewActivityModal
          sheetRef={newActivitySheetRef}
          onActivityCreated={async () => {
            await loadActivities();
            await refreshTagMap();
          }}
          onClose={() => {}}
          onSwitchType={handleSwitchAddType}
        />

        <ProgressLogSheet
          sheetRef={progressSheetRef}
          task={loggingTask}
          currentProgress={loggingTask ? progressMap[loggingTask.id] ?? 0 : 0}
          pace={loggingTask ? paceMap[loggingTask.id] : undefined}
          onLogged={() => loadTasks()}
          onClose={() => setLoggingTask(null)}
        />

        <NewActivityModal
          sheetRef={activityDetailSheetRef}
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  dateHeaderText: { fontSize: 22, color: colors.textPrimary, fontWeight: '800', paddingLeft: 25, paddingTop: 18 },
  stickyHeader: { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, elevation: 2, paddingBottom: 16 },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cancelBtn: { padding: 4 },
  selectionCountText: { fontSize: 16, color: colors.textPrimary, fontWeight: '600' },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  iconActionBtn: { padding: 4 },
  actionDisabled: { opacity: 0.35 },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 90 },
  buttonStuff: {
    width: 60,
    height: 60,
    position: 'absolute',
    bottom: 20,
    right: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    elevation: 6,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  buttonText: { color: colors.textOnAccent, fontSize: 32, fontWeight: '300', textAlign: 'center', marginTop: -3 },
  emptyState: { marginTop: 60, alignItems: 'center', paddingHorizontal: 32 },
  emptyStateText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptyStateSubtext: { fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
  archiveBanner: { marginHorizontal: 20, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.dangerBg, borderRadius: 8, borderWidth: 1, borderColor: colors.dangerBorder },
  archiveBannerText: { fontSize: 12, color: colors.danger, textAlign: 'center' },
});