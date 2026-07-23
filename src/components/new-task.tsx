import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTaskStore } from '../store/taskStore';
import { Task } from './TaskCard';

interface SubTaskDraft {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface NewTaskModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  onTaskCreated: () => void;
  taskToEdit?: Task | null;
  onClose?: () => void;
}




export default function NewTaskModal({ sheetRef, onTaskCreated, taskToEdit, onClose }: NewTaskModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [allowRollover, setallowRollover] = useState(false);

  const { addTask, updateTask, selectedDate } = useTaskStore();

  // States for handling hybrid subtasks
  const [subtasks, setSubtasks] = useState<SubTaskDraft[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const snapPoints = useMemo(() => ["80%",'35%'], []); // Bumped snapPoints to accommodate list growth

  // Add subtask to our draft array
  const handleAddSubtask = () => {
    if (subtaskInput.trim() === '') return;
    
    const newSubtask: SubTaskDraft = {
      id: Date.now().toString(), // Safe local ID generation
      title: subtaskInput.trim(),
      isCompleted: false,
    };

    setSubtasks((prev) => [...prev, newSubtask]);
    setSubtaskInput(''); // Reset field
  };

  // Remove a subtask from our draft array
  const handleRemoveSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter(sub => sub.id !== id));
  };

  // Reset all state variables
  const resetForm = () => {
    setTitle('');
    setType('');
    setPriority('');
    setTargetValue('');
    setUnit('');
    setallowRollover(false);
    setSubtasks([]);
    setSubtaskInput('');
  };



  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title ?? '');
      setType(taskToEdit.type ?? '');
      setPriority(taskToEdit.priority ?? '');
      setallowRollover(Boolean(taskToEdit.rolloverEnabled));

      setTargetValue(taskToEdit.totalProgress ? String(taskToEdit.totalProgress) : '');
      setUnit(taskToEdit.progressUnit ?? '');
    } else {
      resetForm();
    }
  }, [taskToEdit]);


  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      backgroundStyle={{ backgroundColor: "#dedede" }}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.titleText}>New Task Input</Text>

        <BottomSheetTextInput 
          style={styles.input} 
          placeholder="Enter Task Here"
          placeholderTextColor={"#b0b0b0"}
          value={title}
          onChangeText={setTitle}>
        </BottomSheetTextInput>

        <View style={styles.row}>
          <Text style={styles.label}>Type:</Text>
          <View style={styles.selectorGroup}>
            {['Simple', 'Progression', 'Hybrid'].map((t) => {
              const isSelected = type === t;
              return (
                <Pressable 
                  key={t} 
                  style={[styles.selectorItem, isSelected && styles.selectedItem]} 
                  onPress={() => setType(t)}
                >
                  <Text style={isSelected ? styles.selectedText : styles.unselectedText}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Priority:</Text>
          <View style={styles.selectorGroup}>
            {['Low', 'Medium', 'High'].map((p) => {
              const isSelected = priority === p;

              const priorityStyles: Record<string, {item: any; text:any }> = {
                Low: {item: styles.selectedLow, text: styles.textLow},
                Medium: {item: styles.selectedMedium, text: styles.textMedium},
                High: {item: styles.selectedHigh, text: styles.textHigh},
              };
              return (
                <Pressable 
                  key={p} 
                  style={[styles.selectorItem, isSelected && priorityStyles[p].item]} 
                  onPress={() => setPriority(p)}
                >
                  <Text style={[isSelected ? priorityStyles[p].text : styles.unselectedText]}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Rollover Task:</Text>
          <Switch value={allowRollover} onValueChange={setallowRollover} />
        </View>

        {/* PROGRESSION TASK INPUTS */}
        {type === 'Progression' && (
          <View style={styles.dynamicContainer}>
            <View style={styles.row}>
              <Text style={styles.label}>Target Value: </Text>
              <BottomSheetTextInput
                style={styles.inputs}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder="e.g., 100"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Unit:</Text>
              <BottomSheetTextInput
                style={styles.inputStyleNested}
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g., kg, miles, reps"
                placeholderTextColor="#999"
              />
            </View>
          </View>
        )}

        {/* HYBRID TASK INPUTS (SUBTASKS DRAWER) */}
        {type === 'Hybrid' && (
          <View style={styles.dynamicContainer}>
            <Text style={styles.subSectionTitle}>Add Subtasks</Text>
            
            <View style={styles.addSubtaskRow}>
              <BottomSheetTextInput
                style={styles.subtaskTextInput}
                value={subtaskInput}
                onChangeText={setSubtaskInput}
                placeholder="Enter subtask details..."
                placeholderTextColor="#999"
                onSubmitEditing={handleAddSubtask}
              />
              <TouchableOpacity style={styles.addSubtaskButton} onPress={handleAddSubtask}>
                <Text style={styles.addSubtaskButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* List of currently drafted subtasks */}
            {subtasks.length > 0 && (
              <View style={styles.subtaskListContainer}>
                {subtasks.map((item, index) => (
                  <View key={item.id} style={styles.subtaskItemRow}>
                    <Text style={styles.subtaskIndex}>{index + 1}.</Text>
                    <Text style={styles.subtaskTitle} numberOfLines={1}>{item.title}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSubtask(item.id)} style={styles.removeSubtaskButton}>
                      <Text style={styles.removeSubtaskButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Submit Button */}
        <View style={{ marginTop: 24, width: '100%', paddingBottom: 40 }}>
          <Pressable
            disabled={!title.trim()}
            onPress={async () => {
              Keyboard.dismiss();
              if (!title.trim()){
                Alert.alert('Title required', 'Please enter a task title before saving');
                return;
              }
              if (!type) {
                Alert.alert("Type required", 'Please choose Simple, Progression, or Hybrid');
                return;
              }
              if (!priority) {
                Alert.alert('Priority required', 'Please choose a priority.');
                return;
              }
              try{
                const sharedFields = {
                title,
                type: type as "Simple" | "Hybrid" | "Progression" ,
                priority: priority as "Low" | "Medium" | "High",
                rolloverEnabled: allowRollover,
                ...(type === 'Progression' && {
                   totalProgress: Number(targetValue),
                  progressUnit: unit 
                }),
                ...(type === 'Hybrid' && { 
                  subtasksTotal: subtasks.length,
                }),
              };

              if (taskToEdit) {
                await updateTask(taskToEdit.id, sharedFields);
              } else {
                await addTask({
                  ...sharedFields,
                  scheduledDate: selectedDate,
                  ...(type === 'Hybrid' && { subtasksCompleted: 0 }),
                });
              }
              resetForm();
              onTaskCreated();
              if (onClose) onClose();
              sheetRef.current?.close();
            } catch (err) {
              console.error("Failed to save task:", err);
            }
          }
        }
        style={({ pressed }) => [
          styles.submitButton,
          !title.trim() && styles.submitButtonDisabled,
          pressed && title.trim() ? { opacity: 0.85} : null,
        ]}
        > 
        <Text style={styles.submitButtonText}>
          {taskToEdit ? "Update Task" : "Submit Task"}
            </Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: 24,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#222",
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectorGroup: {
    flexDirection: 'row',
  },
  selectorItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginLeft: 6,
  },
  selectedItem: {
    borderColor: '#23ff61',
    backgroundColor: '#e2fee3',
  },
  unselectedText: {
    color: '#333',
    fontSize: 13,
  },
  selectedText: {
    color: '#56db4a',
    fontWeight: '600',
    fontSize: 13,
  },
  selectedLow: {
    backgroundColor: '#e6f0ff',
    borderColor: '#0070f3',
    borderWidth: 1.5,
  },
  textLow: {
    color: '#0070f3',
    fontWeight: '600',
    fontSize: 13,
  },
  selectedMedium: {
    backgroundColor: '#fffbeb',
    borderColor: '#f5d60b',
    borderWidth: 1.5,
  },
  textMedium: {
    color: '#897700',
    fontWeight: '600',
    fontSize: 13,
  },
  selectedHigh: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  textHigh: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
  },
  inputs: {
    flex: 1.5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    marginLeft: 12,
    color: "#222",
  },
  inputStyleNested: {
    flex: 1.5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    marginLeft: 12,
    color: "#222",
  },
  dynamicContainer: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#ececec',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbdbdb',
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subtaskTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    marginRight: 8,
    color: "#222"
  },
  addSubtaskButton: {
    backgroundColor: '#1c8db9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSubtaskButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  subtaskListContainer: {
    marginTop: 8,
    backgroundColor: '#fbfbfb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e2e2',
  },
  subtaskItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subtaskIndex: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888',
    marginRight: 6,
  },
  subtaskTitle: {
    flex: 1,
    fontSize: 13,
    color: '#444444',
  },
  removeSubtaskButton: {
    padding: 4,
    marginLeft: 8,
  },
  removeSubtaskButtonText: {
    fontSize: 12,
    color: '#c40000',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0070f3',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: "#d0d0d0"
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  }
});