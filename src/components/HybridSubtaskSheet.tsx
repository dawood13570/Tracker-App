// HybridSubtaskSheet.tsx

import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSubtasksByParent, insertSubtask } from '../db/queries';
import { Task, useTaskStore } from '../store/taskStore';

interface HybridSubtaskSheetProps {
    sheetRef: React.RefObject<BottomSheet | null>;
    task: Task | null;
    onUpdated: () => void;
    onClose?: () => void;
}

export default function HybridSubtaskSheet({
    sheetRef,
    task,
    onUpdated,
    onClose,
}: HybridSubtaskSheetProps) {
    const { toggleTask, removeTask } = useTaskStore();
    const [subtasks, setSubtasks] = useState<Task[]>([]);
    const [newTitle, setNewTitle] = useState('');

    const snapPoints = useMemo(() => ['70%', '40%'], []);

    const loadSubtasks = async () => {
        if (task) {
            const items = await getSubtasksByParent(task.id);
            setSubtasks(items);
        } else {
            setSubtasks([]);
        }
    };

    useEffect(() => {
        loadSubtasks();
        setNewTitle('');
    }, [task]);

    const handleAddSubtask = async () => {
        if (!task || !newTitle.trim()) return;
        Keyboard.dismiss();

        await insertSubtask(task.id, {
            title: newTitle.trim(),
            scheduledDate: task.scheduledDate,
            priority: task.priority,
        });

        setNewTitle('');
        await loadSubtasks();
        onUpdated();
    };

    const handleToggle = async (subtaskId: number) => {
        await toggleTask(subtaskId);
        await loadSubtasks();
        onUpdated();
    };

    const handleDelete = async (subtaskId: number) => {
        await removeTask(subtaskId);
        await loadSubtasks();
        onUpdated();
    };

    if (!task) {
        return (
            <BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose>
                <View />
             </BottomSheet>
        );
    }

    const completedCount = subtasks.filter((s) => s.isCompleted).length;

    return (
        <BottomSheet
         ref={sheetRef}
         index={-1}
         snapPoints={snapPoints}
         enablePanDownToClose
         backgroundStyle={{ backgroundColor: '#dedede'}}
         keyboardBehavior='fillParent'
         keyboardBlurBehavior='restore'
         onClose={() => {
            setNewTitle('');
            if (onClose) onClose();
         }}
         >
          <BottomSheetScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.titleText}>{task.title}</Text>

            <View style={styles.counterBanner}>
                <Text style={styles.counterText}>
                    {completedCount} / {subtasks.length} Subtasks Completed
                </Text>
            </View>

            {/* Add new subtask input */}
            <View style={styles.inputRow}>
                <BottomSheetTextInput
                style={styles.input}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Add a new subtask..."
                placeholderTextColor="#999"
                onSubmitEditing={handleAddSubtask}
               />
               <TouchableOpacity style={styles.addButton} onPress={handleAddSubtask}>
                 <Text style={styles.addButtonText}>Add</Text>
               </TouchableOpacity>
            </View>

             {/* Subtask items list */}
             <View style={styles.listContainer}>
                {subtasks.length === 0 ? (
                    <Text style={styles.emptyText}>No subtasks yet.</Text>
                ) : (
                    subtasks.map((item) => (
                        <View key={item.id} style={styles.itemRow}>
                            <Pressable style={styles.checkboxContainer} onPress={() => handleToggle(item.id)}>
                                <View style={[styles.checkbox, item.isCompleted && styles.checkboxChecked]}>
                                    {item.isCompleted && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                                <Text style={[styles.subtaskTitle, item.isCompleted && styles.completedTitle]}>
                                    {item.title}
                                </Text>
                            </Pressable>

                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
                                <Text style={styles.deleteButtonText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                    ))
                )}
             </View>
            </BottomSheetScrollView>
           </BottomSheet>
    );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  counterBanner: {
    backgroundColor: '#E1F5FE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0288D1',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#222',
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#1c8db9',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    overflow: 'hidden',
  },
  emptyText: {
    padding: 16,
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1c8db9',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1c8db9',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subtaskTitle: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  deleteButton: {
    padding: 6,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 13,
    color: '#c40000',
    fontWeight: '600',
  },
});

