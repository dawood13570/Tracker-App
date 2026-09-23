import { useColors } from '@/store/themeStore';
import { Palette } from '@/theme/colors';
import Slider from '@react-native-community/slider';
import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface ProgressionSliderProps {
  taskId: number;
  current: number;
  total: number;
  unit?: string | null;
  onUpdate: (taskId: number, val: number) => void;
}

function interpolateProgressColor(percent: number): string {
  const p = Math.max(0, Math.min(1, percent));
  const start = { r: 217, g: 83, b: 79 };
  const end = { r: 46, g: 204, b: 113 };
  return `rgb(${Math.round(start.r + (end.r - start.r) * p)}, ${Math.round(start.g + (end.g - start.g) * p)}, ${Math.round(start.b + (end.b - start.b) * p)})`;
}

export const ProgressionSlider: React.FC<ProgressionSliderProps> = ({
  taskId,
  current,
  total,
  unit,
  onUpdate,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [draftVal, setDraftVal] = useState(current);
  const [isEditingText, setIsEditingText] = useState(false);
  const [textValue, setTextValue] = useState(String(current));

  useEffect(() => {
    setDraftVal(current);
    setTextValue(String(current));
  }, [current]);

  const isDirty = draftVal !== current;
  const clampNonNegative = (val: number) => Math.max(0, Math.round(val));

  // The slider is anchored strictly to `total`.
  // If `current` was already saved above `total` (via manual input),
  // we scale to `current` so the initial thumb position is not off-canvas.
  // Importantly, this NEVER depends on `draftVal`, preventing thumb runaway while dragging.
  const sliderMax = useMemo(() => Math.max(total, current, 1), [total, current]);

  const handleTextSubmit = () => {
    const parsed = Number(textValue);
    setDraftVal(Number.isNaN(parsed) ? draftVal : clampNonNegative(parsed));
    setIsEditingText(false);
    Keyboard.dismiss();
  };

  const percent = draftVal / (total || 1);
  const trackColor = interpolateProgressColor(percent);
  const isOverTarget = draftVal > total;

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
          <Pressable
            onPress={() => {
              setTextValue(String(draftVal));
              setIsEditingText(true);
            }}
          >
            <Text style={styles.progressText}>
              {draftVal} / {total} {unit ?? ''}
            </Text>
          </Pressable>
        )}
        <Text style={[styles.percentageText, isOverTarget && styles.percentageOver]}>
          {Math.round(percent * 100)}%
        </Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={sliderMax}
        step={1}
        value={Math.min(draftVal, sliderMax)}
        onValueChange={(val) => setDraftVal(Math.round(val))}
        minimumTrackTintColor={trackColor}
        maximumTrackTintColor={colors.borderSubtle}
        thumbTintColor={trackColor}
      />

      {isDirty && (
        <View style={styles.confirmRow}>
          <Pressable style={styles.revertBtn} onPress={() => setDraftVal(current)}>
            <Text style={styles.revertBtnText}>Revert</Text>
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={() => onUpdate(taskId, draftVal)}>
            <Text style={styles.confirmBtnText}>
              Confirm {draftVal}/{total}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      marginVertical: 8,
      backgroundColor: colors.surfaceElevated,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    progressText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    percentageText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    percentageOver: {
      color: colors.accent,
      fontWeight: '700',
    },
    textInput: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
      borderBottomWidth: 1,
      borderBottomColor: colors.accent,
      minWidth: 60,
      paddingVertical: 0,
    },
    slider: {
      width: '100%',
      height: 40,
    },
    confirmRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 4,
    },
    revertBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    revertBtnText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    confirmBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    confirmBtnText: {
      color: colors.textOnAccent,
      fontSize: 12,
      fontWeight: '700',
    },
  });