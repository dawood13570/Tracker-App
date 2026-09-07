import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface ProgressionSliderProps {
  taskId: number;
  current: number;
  total: number;
  unit?: string | null;
  onUpdate: (taskId: number, val: number) => void;
}

// ProgressionSlider.tsx — add above the component
function interpolateProgressColor(percent: number): string {
  const p = Math.max(0, Math.min(1, percent));
  const start = { r: 217, g: 83, b: 79 };   // muted red
  const end = { r: 46, g: 204, b: 113 };    // green
  const r = Math.round(start.r + (end.r - start.r) * p);
  const g = Math.round(start.g + (end.g - start.g) * p);
  const b = Math.round(start.b + (end.b - start.b) * p);
  return `rgb(${r}, ${g}, ${b})`;
}

export const ProgressionSlider: React.FC<ProgressionSliderProps> = ({
  taskId,
  current,
  total,
  unit,
  onUpdate,
}) => {
  const [draftVal, setDraftVal] = useState(current);
  const [isEditingText, setIsEditingText] = useState(false);
  const [textValue, setTextValue] = useState(String(current));

  useEffect(() => {
    setDraftVal(current);
    setTextValue(String(current));
  }, [current]);

  const isDirty = draftVal !== current;
  const clamp = (val: number) => Math.max(0, Math.min(total, Math.round(val)));

  const handleTextSubmit = () => {
    const parsed = Number(textValue);
    setDraftVal(Number.isNaN(parsed) ? draftVal : clamp(parsed));
    setIsEditingText(false);
    Keyboard.dismiss();
  };


  const trackColor = interpolateProgressColor(draftVal / (total || 1));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {isEditingText ? (
          <TextInput
            style={styles.textInput}
            value={textValue}
            onChangeText={setTextValue}
            keyboardType="numeric"
            autoFocus
            onSubmitEditing={handleTextSubmit}
            onBlur={handleTextSubmit}
          />
        ) : (
          <Pressable onPress={() => { setTextValue(String(draftVal)); setIsEditingText(true); }}>
            <Text style={styles.progressText}>
              {draftVal} / {total} {unit ?? ''}
            </Text>
          </Pressable>
        )}
        <Text style={styles.percentageText}>{Math.round((draftVal / (total || 1)) * 100)}%</Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={total}
        step={1}
        value={draftVal}
        onValueChange={(val) => setDraftVal(clamp(val))}
        minimumTrackTintColor={trackColor}
        maximumTrackTintColor="#333338"
        thumbTintColor={trackColor}
      />

      {isDirty && (
        <View style={styles.confirmRow}>
          <Pressable style={styles.revertBtn} onPress={() => setDraftVal(current)}>
            <Text style={styles.revertBtnText}>Revert</Text>
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={() => onUpdate(taskId, draftVal)}>
            <Text style={styles.confirmBtnText}>Confirm {draftVal}/{total}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 8, backgroundColor: '#18181c', padding: 12, borderRadius: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  percentageText: { color: '#888', fontSize: 12 },
  textInput: {
    color: '#ffffff', fontSize: 14, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: '#d4af37',
    minWidth: 60, paddingVertical: 0,
  },
  slider: { width: '100%', height: 40 },
  confirmRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  revertBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  revertBtnText: { color: '#888', fontSize: 12, fontWeight: '600' },
  confirmBtn: { backgroundColor: '#d4af37', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  confirmBtnText: { color: '#18181c', fontSize: 12, fontWeight: '700' },
});