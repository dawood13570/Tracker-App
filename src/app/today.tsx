// src/app/(tabs)/today.tsx
import { AddType } from '@/components/AddTypeSwitcher';
import { EventCard } from '@/components/EventCard';
import NewTaskModal from '@/components/new-task';
import NewActivityModal from '@/components/NewActivityModal';
import NewEventModal from '@/components/NewEventModal';
import NewHabitModal from '@/components/NewHabitModal';
import NoteSheet from '@/components/NoteSheet';
import ProgressLogSheet from '@/components/ProgressLogSheet';
import { TagFilterBar } from '@/components/TagFilterBar';
import { TaskCard } from '@/components/TaskCard';
import {
  ensureDailyDecompositionForDate,
  getAllTagAssociations,
  getCurrentProgress,
  getProgressLogsByTask,
  getSubtaskCounts,
} from '@/db/queries';
import { generateDailySeed } from '@/engine/notesSeed';
import { calculatePace, PaceResult } from '@/engine/pace';
import { getEffectivePriority, shouldArchiveTask } from '@/engine/priority';
import { ActivityLogWithDetails, useActivityStore } from '@/store/activityStore';
import { EventRow, useEventStore } from '@/store/eventStore';
import { HabitWithStatus, useHabitStore } from '@/store/habitStore';
import { useTagStore } from '@/store/tagStore';
import { Task, useTaskStore } from '@/store/taskStore';
import { useStore } from '@/store/useStore';
import { runRolloverNow } from '@/tasks/rolloverTask';
import { colors } from '@/theme/colors';
import { getAppToday, getLocalDateString, isEligibleToFinalizeDay } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { parseISO } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
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

function SectionHeader({
  title,
  count,
  isExpanded,
  onToggle,
}: {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.sectionHeaderRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionHeaderIndicator} />
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
        {count > 0 && <Text style={styles.sectionCountText}>({count})</Text>}
      </View>
      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function DateHeader({ dateStr, onOpenNote }: { dateStr: string; onOpenNote: () => void }) {
  const displayDate = useMemo(() => {
    try {
      return parseISO(dateStr).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  }, [dateStr]);

  return (
    <View style={styles.dateHeaderRow}>
      <Text style={styles.dateHeaderText}>{displayDate}</Text>
      <Pressable onPress={onOpenNote} hitSlop={10} style={styles.noteButton}>
        <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
      </Pressable>
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
  const noteSheetRef = useRef<BottomSheet>(null);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loggingTask, setLoggingTask] = useState<Task | null>(null);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [paceMap, setPaceMap] = useState<Record<number, PaceResult>>({});
  const [subtaskMap, setSubtaskMap] = useState<Record<number, { completed: number; total: number }>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({});
  const [editingHabit, setEditingHabit] = useState<HabitWithStatus | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLogWithDetails | null>(null);

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    events: true,
    habits: true,
    activities: true,
    tasks: true,
    completedTasks: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
  const { evolvingPriorityEnabled, autoArchiveEnabled, setManualDayOverrideDate } = useStore();
  const { habits, loadHabits, logHabit, removeHabit } = useHabitStore();
  const { events, loadEvents, removeEvent } = useEventStore();
  const { logsByDate, loadActivitiesForDate, removeActivityEntry } = useActivityStore();
  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, tagVersion } = useTagStore();

  const [todayStr, setTodayStr] = useState<string>(() => getAppToday());
  const canFinalize = useMemo(() => isEligibleToFinalizeDay(), [todayStr]);
  const todaysActivities = logsByDate[todayStr] ?? [];

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

  const refreshDashboard = useCallback(async () => {
    const currentAppDay = getAppToday();
    setTodayStr(currentAppDay);

    await ensureDailyDecompositionForDate(currentAppDay);
    await Promise.all([
      loadTasks(currentAppDay),
      loadHabits(),
      loadEvents(),
      loadActivitiesForDate(currentAppDay),
      refreshTagMap(),
    ]);
  }, [loadTasks, loadHabits, loadEvents, loadActivitiesForDate, refreshTagMap]);

  useEffect(() => {
    const initialLoad = async () => {
      await runRolloverNow();
      await refreshDashboard();
      await Promise.all([loadTags(), loadMostUsedTags()]);
    };

    initialLoad();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshDashboard();
      }
    });

    return () => subscription.remove();
  }, [refreshDashboard, loadTags, loadMostUsedTags]);

  useFocusEffect(
    useCallback(() => {
      refreshDashboard();
    }, [refreshDashboard])
  );

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

  const handleFinalizeDay = async () => {
    Alert.alert(
      'Finalize Day',
      'Wrap up yesterday and roll over your uncompleted items to today?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          style: 'default',
          onPress: async () => {
            const calendarToday = getLocalDateString(new Date());
            setManualDayOverrideDate(calendarToday);
            await runRolloverNow();
            await refreshDashboard();
          },
        },
      ]
    );
  };

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

  const { incompleteTasks, completedTasks } = useMemo(() => {
    return {
      incompleteTasks: visibleTasks.filter((t) => !t.isCompleted),
      completedTasks: visibleTasks.filter((t) => t.isCompleted),
    };
  }, [visibleTasks]);

  const filteredEvents = useMemo(
    () => filterItem(events, tagAssociations.events),
    [events, tagAssociations.events, filterItem]
  );

  const filteredHabits = useMemo(
    () => filterItem(habits, tagAssociations.habits),
    [habits, tagAssociations.habits, filterItem]
  );

  const activitiesForFilter = useMemo(
    () => todaysActivities.map((e) => ({ ...e, title: e.activityTitle })),
    [todaysActivities]
  );

  const activitiesTagMap = useMemo(
    () => Object.fromEntries(todaysActivities.map((e) => [e.id, e.tagIds])),
    [todaysActivities]
  );

  const filteredActivities = useMemo(
    () => filterItem(activitiesForFilter, activitiesTagMap),
    [activitiesForFilter, activitiesTagMap, filterItem]
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
              if (type === 'activity') await removeActivityEntry(id, todayStr);
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
    } else if (type === 'activity') {
      const act = todaysActivities.find((a) => a.id === id);
      if (act) {
        setSelectedActivity(act);
        activityDetailSheetRef.current?.expand();
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
      activitiesState: filteredActivities.map((a) => `${a.id}:${a.note}:${a.tagIds.join('.')}`).join(','),
      expandedTaskIds,
      progressMap,
      paceMap,
      subtaskMap,
      searchQuery,
      selectedFilterTagIds: selectedFilterTagIds.join(','),
      strictTagFilter,
      expandedSections,
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
    expandedSections,
  ]);

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
            <DateHeader dateStr={todayStr} onOpenNote={() => noteSheetRef.current?.expand()} />
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

        <View style={{ flex: 1 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#1c8db9" style={{ marginTop: 40 }} />
          ) : (
            <FlashList
              ref={flashListRef}
              data={expandedSections.tasks ? incompleteTasks : []}
              keyExtractor={(item) => `task-${item.id}`}
              extraData={listExtraData}
              removeClippedSubviews={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TaskCard
                  task={item}
                  onToggle={handleToggleTask}
                  onProgressChanged={loadTasks}
                  currentProgress={progressMap[item.id]}
                  pace={paceMap[item.id]}
                  subtaskCount={subtaskMap[item.id]}
                  isExpanded={Boolean(expandedTaskIds[item.id])}
                  onToggleExpand={() => handleToggleExpand(item.id)}
                  onSubtasksCountUpdate={handleSubtasksCountUpdate}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(`task:${item.id}`)}
                  onLongPressCard={() => handleLongPressItem('task', item.id)}
                  onToggleSelect={() => handleToggleSelectItem('task', item.id)}
                />
              )}
              ListEmptyComponent={
                expandedSections.tasks ? (
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
                ) : null
              }
              ListHeaderComponent={
                <View collapsable={false}>
                  {canFinalize && (
                    <TouchableOpacity
                      style={styles.finalizeBanner}
                      onPress={handleFinalizeDay}
                      activeOpacity={0.8}
                    >
                      <View style={styles.finalizeBannerLeft}>
                        <Ionicons name="moon" size={16} color={colors.accent} />
                        <Text style={styles.finalizeBannerText}>Still in yesterday? Tap to finalize day.</Text>
                      </View>
                      <View style={styles.finalizeActionBtn}>
                        <Text style={styles.finalizeActionText}>Wrap Up</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {filteredEvents.length > 0 && (
                    <>
                      <SectionHeader
                        title="Events"
                        count={filteredEvents.length}
                        isExpanded={expandedSections.events}
                        onToggle={() => toggleSection('events')}
                      />
                      {expandedSections.events &&
                        filteredEvents.map((event) => (
                          <EventCard
                            key={`event-${event.id}`}
                            event={event}
                            selectionMode={selectionMode}
                            isSelected={selectedIds.has(`event:${event.id}`)}
                            onLongPressCard={() => handleLongPressItem('event', event.id)}
                            onToggleSelect={() => handleToggleSelectItem('event', event.id)}
                          />
                        ))}
                    </>
                  )}

                  {filteredHabits.length > 0 && (
                    <>
                      <SectionHeader
                        title="Habits"
                        count={filteredHabits.length}
                        isExpanded={expandedSections.habits}
                        onToggle={() => toggleSection('habits')}
                      />
                      {expandedSections.habits &&
                        filteredHabits.map((habit) => (
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
                    </>
                  )}

                  {filteredActivities.length > 0 && (
                    <>
                      <SectionHeader
                        title="Activities"
                        count={filteredActivities.length}
                        isExpanded={expandedSections.activities}
                        onToggle={() => toggleSection('activities')}
                      />
                      {expandedSections.activities &&
                        filteredActivities.map((entry) => (
                          <ActivityCard
                            key={`activity-${entry.id}`}
                            entry={entry}
                            tags={allTags.filter((t) => entry.tagIds.includes(t.id))}
                            selectionMode={selectionMode}
                            isSelected={selectedIds.has(`activity:${entry.id}`)}
                            onPressCard={() => {
                              setSelectedActivity(entry);
                              activityDetailSheetRef.current?.expand();
                            }}
                            onLongPressCard={() => handleLongPressItem('activity', entry.id)}
                            onToggleSelect={() => handleToggleSelectItem('activity', entry.id)}
                          />
                        ))}
                    </>
                  )}

                  {archivedCount > 0 && selectedFilterTagIds.length === 0 && !searchQuery.trim() && (
                    <View style={styles.archiveBanner}>
                      <Text style={styles.archiveBannerText}>
                        {archivedCount} task{archivedCount > 1 ? 's' : ''} archived until an overdue task is done
                      </Text>
                    </View>
                  )}

                  <SectionHeader
                    title="Tasks"
                    count={incompleteTasks.length}
                    isExpanded={expandedSections.tasks}
                    onToggle={() => toggleSection('tasks')}
                  />
                </View>
              }
              ListFooterComponent={
                completedTasks.length > 0 ? (
                  <View collapsable={false}>
                    <SectionHeader
                      title="Completed"
                      count={completedTasks.length}
                      isExpanded={expandedSections.completedTasks}
                      onToggle={() => toggleSection('completedTasks')}
                    />
                    {expandedSections.completedTasks &&
                      completedTasks.map((item) => (
                        <TaskCard
                          key={`completed-task-${item.id}`}
                          task={item}
                          onToggle={handleToggleTask}
                          onProgressChanged={loadTasks}
                          currentProgress={progressMap[item.id]}
                          pace={paceMap[item.id]}
                          subtaskCount={subtaskMap[item.id]}
                          isExpanded={Boolean(expandedTaskIds[item.id])}
                          onToggleExpand={() => handleToggleExpand(item.id)}
                          onSubtasksCountUpdate={handleSubtasksCountUpdate}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.has(`task:${item.id}`)}
                          onLongPressCard={() => handleLongPressItem('task', item.id)}
                          onToggleSelect={() => handleToggleSelectItem('task', item.id)}
                        />
                      ))}
                  </View>
                ) : null
              }
            />
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
            await loadActivitiesForDate(todayStr);
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
          entry={selectedActivity}
          onActivityCreated={async () => {
            await loadActivitiesForDate(todayStr);
            await refreshTagMap();
          }}
          onClose={() => setSelectedActivity(null)}
        />

        <NoteSheet
          sheetRef={noteSheetRef}
          scope="daily"
          dateKey={todayStr}
          periodLabel={parseISO(todayStr).toLocaleDateString('en-GB', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
          getSeed={() => generateDailySeed(todayStr)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 25,
    paddingRight: 16,
    paddingTop: 18,
  },
  dateHeaderText: { fontSize: 22, color: colors.textPrimary, fontWeight: '800' },
  noteButton: { padding: 6 },
  stickyHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    paddingBottom: 16,
  },
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
  finalizeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  finalizeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  finalizeBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  finalizeActionBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  finalizeActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnAccent,
  },
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
  emptyState: { marginTop: 10, alignItems: 'center', paddingHorizontal: 32 },
  emptyStateText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptyStateSubtext: { fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
  archiveBanner: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  archiveBannerText: { fontSize: 12, color: colors.danger, textAlign: 'center' },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderIndicator: {
    width: 3,
    height: 12,
    backgroundColor: colors.accent,
    borderRadius: 1.5,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
});