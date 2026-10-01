// src/app/pursuits.tsx
import {
  deletePursuit,
  getAllPursuits,
  getSubtasksByParent,
  getTasksByPursuit,
  insertPursuit,
  PursuitRow,
  updatePursuit,
} from '@/db/queries';
import { useTaskStore } from '@/store/taskStore';
import { useColors } from '@/store/themeStore';
import { Palette } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PursuitContents } from '../components/PursuitContents';
import { getEffectiveProgress } from '../db/queries';
import { reportError } from '../utils/errors';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const STATUS_CONFIG: Record<PursuitRow['status'], { label: string; color: string }> = {
  active: { label: 'Active', color: '#22c55e' },
  plan_to_do: { label: 'Plan to Do', color: '#3b82f6' },
  on_hold: { label: 'On Hold', color: '#eab308' },
  dropped: { label: 'Dropped', color: '#ef4444' },
  completed: { label: 'Completed', color: '#a78bfa' },
};

const FILTER_OPTIONS: Array<PursuitRow['status'] | 'all'> = [
  'all',
  'active',
  'plan_to_do',
  'on_hold',
  'dropped',
  'completed',
];

export default function PursuitsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { toggleTask } = useTaskStore();

  const [pursuits, setPursuits] = useState<PursuitRow[]>([]);
  const [tasksByPursuitMap, setTasksByPursuitMap] = useState<Record<number, any[]>>({});
  const [search, setSearch] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [filter, setFilter] = useState<PursuitRow['status'] | 'all'>('all');

  // Detail Sheet State
  const [detailPursuit, setDetailPursuit] = useState<PursuitRow | null>(null);
  const [detailTasks, setDetailTasks] = useState<any[]>([]);
  const [subtasksMap, setSubtasksMap] = useState<Record<number, any[]>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({});
  const [editingTitle, setEditingTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Swipe-to-dismiss gesture setup
  const panY = useRef(new Animated.Value(0)).current;
  const resetPositionAnim = Animated.timing(panY, {
    toValue: 0,
    duration: 200,
    useNativeDriver: true,
  });

  const closeDetail = useCallback(() => {
    Animated.timing(panY, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setDetailPursuit(null);
      panY.setValue(0);
    });
  }, [panY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            panY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.6) {
            closeDetail();
          } else {
            resetPositionAnim.start();
          }
        },
      }),
    [closeDetail, panY, resetPositionAnim]
  );

  // Create Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStatus, setNewStatus] = useState<PursuitRow['status']>('active');

  const loadPursuits = useCallback(async () => {
    const list = await getAllPursuits();
    setPursuits(list);

    const taskMap: Record<number, any[]> = {};
    for (const p of list) {
      taskMap[p.id] = await getTasksByPursuit(p.id);
    }
    setTasksByPursuitMap(taskMap);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPursuits().catch(reportError);
    }, [loadPursuits])
  );

  const filteredPursuits = useMemo(
    () =>
      pursuits.filter(
        (p) =>
          (filter === 'all' || p.status === filter) &&
          `${p.title} ${p.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
      ),
    [pursuits, filter, search]
  );

  const fetchDetailSubtasks = async (tasks: any[]) => {
    const subMap: Record<number, any[]> = {};
    for (const t of tasks) {
      if (t.type === 'Hybrid' || (t.subtasksTotal ?? 0) > 0) {
        subMap[t.id] = await getSubtasksByParent(t.id);
      }
    }
    setSubtasksMap(subMap);
  };

  const openDetail = async (p: PursuitRow) => {
    try {
      panY.setValue(0);
      setDetailPursuit(p);
      setDescriptionDraft(Storage.getItemSync(`reckon-pursuit-draft:${p.id}`) ?? p.description ?? '');
      setEditingTitle(p.title);
      setIsEditingTitle(false);
      setExpandedTaskIds({});
      const tasks = await getTasksByPursuit(p.id);
      const tasksWithProgress = await Promise.all(
        tasks.map(async (t) => ({ ...t, currentProgress: await getEffectiveProgress(t.id) }))
      );
      setDetailTasks(tasksWithProgress);
      await fetchDetailSubtasks(tasks);
    } catch (error) {
      reportError(error);
    }
  };

  const handleCreate = async () => {
    try {
      if (!newTitle.trim()) return;
      await insertPursuit({ title: newTitle.trim(), status: newStatus });
      setNewTitle('');
      setNewStatus('active');
      setIsCreating(false);
      await loadPursuits();
    } catch (error) {
      reportError(error);
    }
  };

  const handleStatusChange = async (status: PursuitRow['status']) => {
    try {
      if (!detailPursuit) return;
      const updated = await updatePursuit(detailPursuit.id, { status });
      setDetailPursuit(updated);
      setPursuits((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      reportError(error);
    }
  };

  const handleTitleSave = async () => {
    try {
      if (!detailPursuit || !editingTitle.trim()) {
        setIsEditingTitle(false);
        return;
      }
      const updated = await updatePursuit(detailPursuit.id, { title: editingTitle.trim() });
      setDetailPursuit(updated);
      setPursuits((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setIsEditingTitle(false);
    } catch (error) {
      reportError(error);
    }
  };

  const handleDescriptionSave = async (text: string) => {
    try {
      if (!detailPursuit) return;
      const updated = await updatePursuit(detailPursuit.id, { description: text.trim() || null });
      Storage.removeItemSync(`reckon-pursuit-draft:${detailPursuit.id}`);
      setDetailPursuit(updated);
      setPursuits((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      reportError(error);
    }
  };

  const handleToggleLinkedTask = async (taskId: number) => {
    if (!detailPursuit) return;
    await toggleTask(taskId);
    const updatedTasks = await getTasksByPursuit(detailPursuit.id);
    const tasksWithProgress = await Promise.all(
      updatedTasks.map(async (t) => ({ ...t, currentProgress: await getEffectiveProgress(t.id) }))
    );
    setDetailTasks(tasksWithProgress);
    setTasksByPursuitMap((prev) => ({ ...prev, [detailPursuit.id]: updatedTasks }));
    await fetchDetailSubtasks(updatedTasks);
  };

  const handleToggleSubtask = async (subtaskId: number) => {
    if (!detailPursuit) return;
    await toggleTask(subtaskId);
    const updatedTasks = await getTasksByPursuit(detailPursuit.id);
    const tasksWithProgress = await Promise.all(
      updatedTasks.map(async (t) => ({ ...t, currentProgress: await getEffectiveProgress(t.id) }))
    );
    setDetailTasks(tasksWithProgress);
    setTasksByPursuitMap((prev) => ({ ...prev, [detailPursuit.id]: updatedTasks }));
    await fetchDetailSubtasks(updatedTasks);
  };

  const toggleExpand = (taskId: number) => {
    setExpandedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleDelete = () => {
    if (!detailPursuit) return;
    Alert.alert(
      'Delete Pursuit',
      `Delete "${detailPursuit.title}"? Linked tasks, habits, events, activities, and notes will stay, just unlinked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePursuit(detailPursuit.id);
            setDetailPursuit(null);
            await loadPursuits();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Pursuits</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsCreating(true)}>
          <Ionicons name="add" size={20} color={colors.textOnAccent} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {FILTER_OPTIONS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={filter === f ? styles.filterChipTextActive : styles.filterChipText}>
                {f === 'all' ? 'All' : STATUS_CONFIG[f].label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TextInput
        accessibilityLabel="Search pursuits"
        value={search}
        onChangeText={setSearch}
        placeholder="Search pursuits"
        placeholderTextColor={colors.textPlaceholder}
        style={styles.searchInput}
      />

      {/* Pursuit Card List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredPursuits.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="compass-outline" size={32} color={colors.textMuted} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyStateText}>No pursuits here yet.</Text>
          </View>
        ) : (
          filteredPursuits.map((p) => {
            const linked = tasksByPursuitMap[p.id] ?? [];
            const total = linked.length;

            return (
              <TouchableOpacity key={p.id} style={styles.pursuitCard} onPress={() => openDetail(p)}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardHeaderLine}>
                    <Text style={styles.pursuitTitle} numberOfLines={1}>
                      {p.title}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: STATUS_CONFIG[p.status].color + '22',
                          borderColor: STATUS_CONFIG[p.status].color,
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: STATUS_CONFIG[p.status].color }]}>
                        {STATUS_CONFIG[p.status].label}
                      </Text>
                    </View>
                  </View>

                  {p.description ? (
                    <Text style={styles.pursuitDesc} numberOfLines={2}>
                      {p.description}
                    </Text>
                  ) : null}

                  <Text style={styles.cardProgressText}>{total} linked task records · status chosen by you</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Create Pursuit Modal */}
      <Modal visible={isCreating} transparent animationType="slide" onRequestClose={() => setIsCreating(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <Text style={styles.modalTitle}>New Pursuit</Text>
              <TextInput
                style={styles.modalInput}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Learn Guitar, Strength Training"
                placeholderTextColor={colors.textPlaceholder}
                autoFocus
              />

              <Text style={[styles.detailLabel, { marginTop: 14 }]}>INITIAL STATUS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {(Object.keys(STATUS_CONFIG) as PursuitRow['status'][]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusOption,
                      newStatus === s && {
                        borderColor: STATUS_CONFIG[s].color,
                        backgroundColor: STATUS_CONFIG[s].color + '22',
                      },
                    ]}
                    onPress={() => setNewStatus(s)}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        newStatus === s && { color: STATUS_CONFIG[s].color, fontWeight: '700' },
                      ]}
                    >
                      {STATUS_CONFIG[s].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Pressable style={styles.modalCancelBtn} onPress={() => setIsCreating(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalSaveBtn} onPress={handleCreate}>
                  <Text style={styles.modalSaveText}>Create</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Draggable Slide-to-Dismiss Detail Sheet */}
      <Modal
        visible={Boolean(detailPursuit)}
        transparent
        animationType="fade"
        onRequestClose={closeDetail}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop Tap to Close */}
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDetail} />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', justifyContent: 'flex-end' }}
          >
            <Animated.View
              style={[
                styles.modalCard,
                {
                  maxHeight: SCREEN_HEIGHT * 0.9,
                  paddingBottom: Math.max(insets.bottom, 16),
                  transform: [{ translateY: panY }],
                },
              ]}
            >
              {/* Drag Handle Bar */}
              <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
                <View style={styles.dragIndicator} />
              </View>

              {detailPursuit && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Title & Delete Header */}
                  <View style={styles.detailHeaderRow}>
                    {isEditingTitle ? (
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                          style={styles.editTitleInput}
                          value={editingTitle}
                          onChangeText={setEditingTitle}
                          autoFocus
                          onBlur={handleTitleSave}
                          onSubmitEditing={handleTitleSave}
                        />
                        <TouchableOpacity onPress={handleTitleSave}>
                          <Ionicons name="checkmark" size={22} color={colors.accent} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        onPress={() => setIsEditingTitle(true)}
                      >
                        <Text style={styles.modalTitle}>{detailPursuit.title}</Text>
                        <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}

                    <Pressable onPress={handleDelete} hitSlop={8} style={{ marginLeft: 8 }}>
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                  </View>

                  {/* Status Picker */}
                  <Text style={styles.detailLabel}>STATUS</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    {(Object.keys(STATUS_CONFIG) as PursuitRow['status'][]).map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.statusOption,
                          detailPursuit.status === s && {
                            borderColor: STATUS_CONFIG[s].color,
                            backgroundColor: STATUS_CONFIG[s].color + '22',
                          },
                        ]}
                        onPress={() => handleStatusChange(s)}
                      >
                        <Text
                          style={[
                            styles.statusOptionText,
                            detailPursuit.status === s && {
                              color: STATUS_CONFIG[s].color,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {STATUS_CONFIG[s].label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Notes / Overview */}
                  <Text style={styles.detailLabel}>NOTES</Text>
                  <TextInput
                    style={styles.descriptionInput}
                    value={descriptionDraft}
                    onChangeText={(text) => {
                      setDescriptionDraft(text);
                      Storage.setItemSync(`reckon-pursuit-draft:${detailPursuit.id}`, text);
                    }}
                    onEndEditing={(e) => {
                      handleDescriptionSave(e.nativeEvent.text).catch(reportError);
                    }}
                    multiline
                    placeholder="Why this pursuit matters, milestones, current state..."
                    placeholderTextColor={colors.textPlaceholder}
                  />

                  {/* Date-Grouped Timeline (Tasks, Habits, Activities, Events, Notes) */}
                  <PursuitContents
                    pursuitId={detailPursuit.id}
                    tasks={detailTasks}
                    subtasksMap={subtasksMap}
                    expandedTaskIds={expandedTaskIds}
                    onToggleTask={handleToggleLinkedTask}
                    onToggleSubtask={handleToggleSubtask}
                    onToggleExpandTask={toggleExpand}
                    onChanged={() => {
                      void loadPursuits();
                      getTasksByPursuit(detailPursuit.id).then(async (tasks) => {
                        const tasksWithProgress = await Promise.all(
                          tasks.map(async (t) => ({ ...t, currentProgress: await getEffectiveProgress(t.id) }))
                        );
                        setDetailTasks(tasksWithProgress);
                      });
                    }}
                    onOpenNote={(id) => {
                      setDetailPursuit(null);
                      router.push({ pathname: '/notes-history', params: { noteId: id } });
                    }}
                  />
                </ScrollView>
              )}
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    pageTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
    addBtn: {
      backgroundColor: colors.accent,
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterWrapper: { marginBottom: 12 },
    filterContainer: { paddingHorizontal: 16, gap: 8 },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    filterChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    filterChipTextActive: { fontSize: 12, color: colors.textOnAccent, fontWeight: '700' },
    searchInput: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 12,
      borderRadius: 10,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    emptyState: { alignItems: 'center', marginTop: 60, gap: 8 },
    emptyStateText: { fontSize: 13, color: colors.textMuted },
    pursuitCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: 14,
      marginBottom: 10,
    },
    cardHeaderLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    pursuitTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
    pursuitDesc: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
    statusBadgeText: { fontSize: 10, fontWeight: '700' },
    cardProgressText: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    dragHandleArea: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    dragIndicator: {
      width: 40,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.border,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    editTitleInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      borderBottomWidth: 1,
      borderColor: colors.accent,
      paddingVertical: 2,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      backgroundColor: colors.surfaceSubtle,
      color: colors.textPrimary,
      marginTop: 16,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
    },
    modalCancelText: { color: colors.textSecondary, fontWeight: '600' },
    modalSaveBtn: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: colors.accent,
    },
    modalSaveText: { color: colors.textOnAccent, fontWeight: '700' },
    detailHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 4,
    },
    statusOption: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
    },
    statusOptionText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    descriptionInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 13,
      backgroundColor: colors.surfaceSubtle,
      color: colors.textPrimary,
      minHeight: 70,
      textAlignVertical: 'top',
      marginBottom: 12,
    },
  });