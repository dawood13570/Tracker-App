import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

interface NewTaskModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
}

export default function NewTaskModal({ sheetRef }: NewTaskModalProps) {
  const snapPoints = useMemo(() => ['25%', '50%'], []);

  return (
    <BottomSheet
    ref={sheetRef}
    index={-1}
    snapPoints={snapPoints}
    enablePanDownToClose={true}
    >
      <BottomSheetView style={styles.contentContainer}>
        <Text style={styles.titleText}>New Task Input Canvas</Text>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
  },
});