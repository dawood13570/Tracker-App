import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useMemo, useState } from 'react';
import { Button, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { insertTask } from '../db/queries';

interface SubTaskDraft {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface NewTaskModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  onTaskCreated: () => void;
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function NewTaskModal({ sheetRef, onTaskCreated }: NewTaskModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [allowRollover, setallowRollover] = useState(false);
  
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
      <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
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
          <Button
            title="Submit Task"
            onPress={async () => {
              try{
                await insertTask({
                title,
                type: type as "Simple" | "Hybrid" | "Progression" ,
                priority: priority.toLowerCase() as "low" | "medium" | "high",
                rolloverEnabled: allowRollover,
                scheduledDate: getLocalDateString(),
                ...(type === 'Progression' && {
                   totalProgress: Number(targetValue),
                  progressUnit: unit 
                }),
                ...(type === 'Hybrid' && { 
                  subtasksTotal: subtasks.length,
                  subtasksCompleted: 0, 
                }),
              });
              resetForm();
              onTaskCreated();
              sheetRef.current?.close();
            } catch (err) {
              console.error("Failed to save task:", err);
            }
          }
        }
          />
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
});