// src/components/PursuitContents.tsx
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createNote,
  getActivityLogs,
  getAllLinkableTasks,
  getHabitsByDate,
  getPursuitEntities,
  logHabitCompletion,
  setEntityPursuit,
  type PursuitEntityKind,
} from '../db/queries';
import { useColors } from '../store/themeStore';
import { Palette } from '../theme/colors';
import { getAppToday } from '../utils/date';
import { reportError } from '../utils/errors';

type Entity = {
  id: number;
  title: string | null;
  pursuitId: number | null;
  content?: string | null;
  startTime?: string;
  endTime?: string | null;
  location?: string | null;
};

interface DateGroupItem {
  id: string;
  type: PursuitEntityKind;
  rawId: number;
  title: string;
  subtitle?: string;
  isCompleted?: boolean;
  meta?: any;
}

export function PursuitContents({
  pursuitId,
  tasks = [],
  subtasksMap = {},
  expandedTaskIds = {},
  onToggleTask,
  onToggleSubtask,
  onToggleExpandTask,
  onOpenNote,
  onChanged,
}: {
  pursuitId: number;
  tasks?: any[];
  subtasksMap?: Record<number, any[]>;
  expandedTaskIds?: Record<number, boolean>;
  onToggleTask?: (id: number) => void;
  onToggleSubtask?: (id: number) => void;
  onToggleExpandTask?: (id: number) => void;
  onOpenNote: (id: number) => void;
  onChanged: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = getAppToday();

  const [data, setData] = useState<Awaited<ReturnType<typeof getPursuitEntities>> | null>(null);
  const [choices, setChoices] = useState<Entity[]>([]);
  const [kind, setKind] = useState<PursuitEntityKind | null>(null);
  const [search, setSearch] = useState('');
  const [habitDone, setHabitDone] = useState<Record<number, boolean>>({});
  const [logs, setLogs] = useState<Record<number, Awaited<ReturnType<typeof getActivityLogs>>>>({});
  const [busy, setBusy] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({ [today]: true });

  const load = useCallback(async () => {
    const [contents, habits] = await Promise.all([
      getPursuitEntities(pursuitId),
      getHabitsByDate(today),
    ]);
    setData(contents);
    setHabitDone(Object.fromEntries(habits.map((h) => [h.id, h.isCompletedToday])));
    const history = await Promise.all(
      contents.activities.map(async (a) => [a.id, await getActivityLogs(a.id)] as const)
    );
    setLogs(Object.fromEntries(history));
  }, [pursuitId, today]);

  useEffect(() => {
    load().catch(reportError);
  }, [load]);

  const action = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      await load();
      onChanged();
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = (type: PursuitEntityKind, itemId: number, title: string) => {
    Alert.alert(
      'Unlink Item',
      `Unlink "${title || 'this item'}" from this pursuit?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: () => void action(() => setEntityPursuit(type, itemId, null)),
        },
      ]
    );
  };

  const pick = async (type: PursuitEntityKind) => {
    try {
      const all = await getPursuitEntities();
      const rows =
        type === 'task'
          ? await getAllLinkableTasks()
          : type === 'habit'
          ? all.habits
          : type === 'event'
          ? all.events
          : type === 'activity'
          ? all.activities
          : all.notes;
      setChoices(rows.filter((r) => r.pursuitId == null));
      setKind(type);
      setSearch('');
    } catch (error) {
      reportError(error);
    }
  };

  const groupedByDate = useMemo(() => {
    const map: Record<string, DateGroupItem[]> = {};

    const addItem = (dateKey: string, item: DateGroupItem) => {
      const d = dateKey || 'Undated';
      if (!map[d]) map[d] = [];
      map[d].push(item);
    };

    tasks.forEach((t) => {
      addItem(t.scheduledDate, {
        id: `task-${t.id}`,
        type: 'task',
        rawId: t.id,
        title: t.title,
        subtitle: `${t.scope?.toUpperCase() || 'TASK'}${
          t.type === 'Progression' && t.totalProgress
            ? ` · ${t.currentProgress ?? 0}/${t.totalProgress}${t.progressUnit ?? ''}`
            : ''
        }`,
        isCompleted: Boolean(t.isCompleted),
        meta: t,
      });
    });

    (data?.events ?? []).forEach((e) => {
      const datePart = e.startTime?.split('T')[0] ?? 'Undated';
      addItem(datePart, {
        id: `event-${e.id}`,
        type: 'event',
        rawId: e.id,
        title: e.title || 'Untitled Event',
        subtitle: `${e.startTime?.replace('T', ' ')}${e.endTime ? ` → ${e.endTime.replace('T', ' ')}` : ''}${
          e.location ? ` · ${e.location}` : ''
        }`,
      });
    });

    (data?.activities ?? []).forEach((a) => {
      const actLogs = logs[a.id] ?? [];
      if (actLogs.length > 0) {
        actLogs.forEach((l) => {
          addItem(l.date, {
            id: `actlog-${l.id}`,
            type: 'activity',
            rawId: a.id,
            title: a.title || 'Activity Log',
            subtitle: l.note ? `Note: ${l.note}` : undefined,
          });
        });
      } else {
        addItem('Undated', {
          id: `act-${a.id}`,
          type: 'activity',
          rawId: a.id,
          title: a.title || 'Activity',
          subtitle: 'Never logged',
        });
      }
    });

    (data?.habits ?? []).forEach((h) => {
      addItem(today, {
        id: `habit-${h.id}`,
        type: 'habit',
        rawId: h.id,
        title: h.title || 'Untitled Habit',
        isCompleted: habitDone[h.id],
      });
    });

    (data?.notes ?? []).forEach((n: any) => {
      addItem(n.date ?? 'Undated', {
        id: `note-${n.id}`,
        type: 'note',
        rawId: n.id,
        title: n.title || n.content?.slice(0, 60) || 'Untitled Reflection',
      });
    });

    return map;
  }, [tasks, data, logs, habitDone, today]);

  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedByDate).sort((a, b) => {
      if (a === 'Undated') return 1;
      if (b === 'Undated') return -1;
      return b.localeCompare(a);
    });
  }, [groupedByDate]);

  const formatDayHeader = (dateStr: string) => {
    if (dateStr === 'Undated') return 'Undated';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const dateObj = new Date(y, m - 1, d);
      const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
      if (dateStr === today) {
        return `Today · ${dayName}`;
      }
      return `${dateStr} · ${dayName}`;
    } catch {
      return dateStr;
    }
  };

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const handleOpenLinkOptions = () => {
    const options = [
      'Cancel',
      'Task',
      'Habit',
      'Activity',
      'Event',
      'Note / Reflection',
      'Write New Reflection',
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, title: 'Link Item to Pursuit' },
        (btnIndex) => {
          if (btnIndex === 1) void pick('task');
          if (btnIndex === 2) void pick('habit');
          if (btnIndex === 3) void pick('activity');
          if (btnIndex === 4) void pick('event');
          if (btnIndex === 5) void pick('note');
          if (btnIndex === 6) {
            void action(async () => {
              const note = await createNote('daily', today, '', undefined, false, pursuitId);
              onOpenNote(note.id);
            });
          }
        }
      );
    } else {
      setShowAndroidPicker(true);
    }
  };

  return (
    <View style={styles.container}>
      {sortedDateKeys.length === 0 ? (
        <Text style={styles.emptyNotice}>No linked items or logs recorded yet.</Text>
      ) : (
        sortedDateKeys.map((dateKey) => {
          const items = groupedByDate[dateKey];
          const isExpanded = Boolean(expandedDates[dateKey]);
          const isToday = dateKey === today;

          return (
            <View key={dateKey} style={styles.dateBlock}>
              <TouchableOpacity
                style={styles.dateHeader}
                onPress={() => toggleDate(dateKey)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={14}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.dateTitle, isToday && { color: colors.accent }]}>
                    {formatDayHeader(dateKey)}
                  </Text>
                  <Text style={styles.itemCountBadge}>({items.length})</Text>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.dateItemList}>
                  {items.map((item) => {
                    const taskSubtasks = subtasksMap[item.rawId] ?? [];
                    const hasSubtasks = item.type === 'task' && taskSubtasks.length > 0;
                    const isTaskExpanded = Boolean(expandedTaskIds[item.rawId]);

                    return (
                      <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemMainRow}>
                          {item.type === 'task' && (
                            <TouchableOpacity
                              onPress={() => onToggleTask?.(item.rawId)}
                              style={styles.checkSlot}
                            >
                              <Ionicons
                                name={item.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                                size={18}
                                color={item.isCompleted ? colors.accent : colors.textMuted}
                              />
                            </TouchableOpacity>
                          )}

                          {item.type === 'habit' && (
                            <TouchableOpacity
                              onPress={() => void action(() => logHabitCompletion(item.rawId, today))}
                              style={styles.checkSlot}
                            >
                              <Ionicons
                                name={item.isCompleted ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={item.isCompleted ? colors.accent : colors.textMuted}
                              />
                            </TouchableOpacity>
                          )}

                          {item.type === 'activity' && (
                            <View style={styles.checkSlot}>
                              <Ionicons name="barbell-outline" size={16} color={colors.accent} />
                            </View>
                          )}

                          {item.type === 'event' && (
                            <View style={styles.checkSlot}>
                              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                            </View>
                          )}

                          {item.type === 'note' && (
                            <View style={styles.checkSlot}>
                              <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                            </View>
                          )}

                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.itemTitleText,
                                item.isCompleted && styles.itemTitleCompleted,
                              ]}
                            >
                              {item.title}
                            </Text>
                            {item.subtitle ? (
                              <Text style={styles.itemSubtitleText}>{item.subtitle}</Text>
                            ) : null}
                          </View>

                          {item.type === 'note' && (
                            <TouchableOpacity
                              onPress={() => onOpenNote(item.rawId)}
                              style={styles.smallActionBtn}
                            >
                              <Text style={styles.smallActionText}>Open</Text>
                            </TouchableOpacity>
                          )}

                          {hasSubtasks && (
                            <TouchableOpacity
                              onPress={() => onToggleExpandTask?.(item.rawId)}
                              hitSlop={8}
                              style={{ padding: 4 }}
                            >
                              <Ionicons
                                name={isTaskExpanded ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color={colors.textMuted}
                              />
                            </TouchableOpacity>
                          )}

                          {/* Unlink Action Button */}
                          <TouchableOpacity
                            onPress={() => handleUnlink(item.type, item.rawId, item.title)}
                            hitSlop={8}
                            style={styles.unlinkBtn}
                          >
                            <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>

                        {hasSubtasks && isTaskExpanded && (
                          <View style={styles.subtasksContainer}>
                            {taskSubtasks.map((st) => (
                              <TouchableOpacity
                                key={st.id}
                                style={styles.subtaskRow}
                                onPress={() => onToggleSubtask?.(st.id)}
                              >
                                <Ionicons
                                  name={st.isCompleted ? 'checkbox' : 'square-outline'}
                                  size={14}
                                  color={st.isCompleted ? colors.accent : colors.textMuted}
                                />
                                <Text
                                  style={[
                                    styles.subtaskTitle,
                                    st.isCompleted && styles.subtaskTitleDone,
                                  ]}
                                >
                                  {st.title}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Button Placed at the Very Bottom */}
      <TouchableOpacity style={styles.bottomLinkButton} onPress={handleOpenLinkOptions}>
        <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
        <Text style={styles.bottomLinkButtonText}>Link item</Text>
      </TouchableOpacity>

      {/* Android Fallback Action Picker */}
      <Modal visible={showAndroidPicker} transparent animationType="fade" onRequestClose={() => setShowAndroidPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAndroidPicker(false)}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Link Item to Pursuit</Text>
            {(['task', 'habit', 'activity', 'event', 'note'] as PursuitEntityKind[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.pickerOption}
                onPress={() => {
                  setShowAndroidPicker(false);
                  void pick(t);
                }}
              >
                <Text style={styles.pickerOptionText}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.pickerOption, { borderTopWidth: 1, borderColor: colors.borderSubtle }]}
              onPress={() => {
                setShowAndroidPicker(false);
                void action(async () => {
                  const note = await createNote('daily', today, '', undefined, false, pursuitId);
                  onOpenNote(note.id);
                });
              }}
            >
              <Text style={[styles.pickerOptionText, { color: colors.accent }]}>+ Write New Reflection</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Item Selection Modal */}
      <Modal visible={Boolean(kind)} transparent animationType="slide" onRequestClose={() => setKind(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.selectionSheet}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Link {kind ? kind.toUpperCase() : ''}</Text>
              <TouchableOpacity onPress={() => setKind(null)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TextInput
              autoFocus
              placeholder={`Search unlinked ${kind}s...`}
              placeholderTextColor={colors.textPlaceholder}
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />

            <ScrollView style={{ maxHeight: 280 }}>
              {choices
                .filter((c) => `${c.title ?? ''} ${c.content ?? ''}`.toLowerCase().includes(search.toLowerCase()))
                .map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.choiceRow}
                    onPress={() =>
                      void action(async () => {
                        if (!kind) return;
                        await setEntityPursuit(kind, c.id, pursuitId);
                        setKind(null);
                      })
                    }
                  >
                    <Text style={styles.choiceTitle}>{c.title || c.content?.slice(0, 60) || 'Untitled'}</Text>
                    <Ionicons name="add" size={18} color={colors.accent} />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
    },
    dateBlock: {
      marginBottom: 10,
    },
    dateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      marginBottom: 4,
    },
    dateTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    itemCountBadge: {
      fontSize: 11,
      color: colors.textMuted,
    },
    dateItemList: {
      gap: 6,
      paddingLeft: 8,
      borderLeftWidth: 1.5,
      borderLeftColor: colors.borderSubtle,
      marginLeft: 6,
    },
    itemCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    itemMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkSlot: {
      width: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemTitleText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    itemTitleCompleted: {
      textDecorationLine: 'line-through',
      color: colors.textMuted,
    },
    itemSubtitleText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    smallActionBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
      backgroundColor: colors.surfaceSubtle,
    },
    smallActionText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },
    unlinkBtn: {
      padding: 4,
      marginLeft: 2,
    },
    subtasksContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingLeft: 26,
      gap: 6,
    },
    subtaskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    subtaskTitle: {
      fontSize: 12,
      color: colors.textPrimary,
    },
    subtaskTitleDone: {
      textDecorationLine: 'line-through',
      color: colors.textMuted,
    },
    bottomLinkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      marginTop: 16,
      marginBottom: 20,
      borderRadius: 8,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    bottomLinkButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },
    emptyNotice: {
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: 'italic',
      marginVertical: 12,
      textAlign: 'center',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 20,
    },
    pickerBox: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 8,
      overflow: 'hidden',
    },
    pickerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    pickerOption: {
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    pickerOptionText: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    selectionSheet: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      maxHeight: '80%',
    },
    selectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    selectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceSubtle,
      fontSize: 13,
      marginBottom: 12,
    },
    choiceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    choiceTitle: {
      fontSize: 13,
      color: colors.textPrimary,
      flex: 1,
      marginRight: 8,
    },
  });