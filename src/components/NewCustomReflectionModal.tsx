// src/components/NewCustomReflectionModal.tsx
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  sheetRef: React.RefObject<BottomSheet | null>;
  onConfirmed: (title: string, startDate: string, endDate: string) => void;
  onClose?: () => void;
}

export default function NewCustomReflectionModal({ sheetRef, onConfirmed, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const snapPoints = useMemo(() => ['55%'], []);

  const handleCreate = () => {
    Keyboard.dismiss();
    if (!title.trim() || !startDate.trim() || !endDate.trim()) {
      Alert.alert('Missing Info', 'Please provide a title, start date, and end date (YYYY-MM-DD).');
      return;
    }

    onConfirmed(title.trim(), startDate.trim(), endDate.trim());
    sheetRef.current?.close();
    if (onClose) onClose();
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Custom Period Reflection</Text>

        <BottomSheetTextInput
          style={styles.input}
          placeholder="Period Name (e.g. Ramadan 1447, Finals Sprint)"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.dateRow}>
          <BottomSheetTextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Start (YYYY-MM-DD)"
            placeholderTextColor={colors.textPlaceholder}
            value={startDate}
            onChangeText={setStartDate}
          />
          <BottomSheetTextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="End (YYYY-MM-DD)"
            placeholderTextColor={colors.textPlaceholder}
            value={endDate}
            onChangeText={setEndDate}
          />
        </View>

        <Pressable style={styles.submitBtn} onPress={handleCreate}>
          <Text style={styles.submitText}>Open Reflection</Text>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 14 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: colors.surfaceSubtle,
    color: colors.textPrimary,
  },
  dateRow: { flexDirection: 'row', gap: 10 },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: colors.textOnAccent, fontWeight: '700', fontSize: 15 },
});