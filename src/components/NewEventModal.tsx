import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  assignTagToEvent,
  getTagsForEvent,
  removeTagFromEvent,
} from '../db/queries';
import { EventRow, useEventStore } from '../store/eventStore';
import { useTagStore } from '../store/tagStore';
import { colors } from '../theme/colors';
import { AddType, AddTypeSwitcher } from './AddTypeSwitcher';
import { TagPicker } from './TagPicker';

interface NewEventModalProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  onEventCreated: () => void;
  eventToEdit?: EventRow | null;
  onClose?: () => void;
  onSwitchType?: (type: AddType) => void;
}

export default function NewEventModal({
  sheetRef,
  onEventCreated,
  eventToEdit,
  onClose,
  onSwitchType,
}: NewEventModalProps) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [hasEndTime, setHasEndTime] = useState(false);
  const [endTime, setEndTime] = useState(new Date());
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const { addEvent, updateEvent } = useEventStore();
  const { tags: allTags, mostUsedTags, loadTags, loadMostUsedTags, addTag, removeTag } = useTagStore();

  const snapPoints = useMemo(() => ['65%', '40%'], []);

  const resetForm = () => {
    setTitle('');
    setLocation('');
    setDate(new Date());
    setStartTime(new Date());
    setHasEndTime(false);
    setEndTime(new Date());
    setSelectedTagIds([]);
  };

  useEffect(() => {
    loadTags();
    loadMostUsedTags();
  }, []);

  useEffect(() => {
    if (eventToEdit) {
      const start = new Date(eventToEdit.startTime);
      setTitle(eventToEdit.title);
      setLocation(eventToEdit.location ?? '');
      setDate(start);
      setStartTime(start);
      if (eventToEdit.endTime) {
        setHasEndTime(true);
        setEndTime(new Date(eventToEdit.endTime));
      } else {
        setHasEndTime(false);
      }
      getTagsForEvent(eventToEdit.id).then((rows) => setSelectedTagIds(rows.map((r) => r.id)));
    } else {
      resetForm();
    }
  }, [eventToEdit]);

  const combineDateAndTime = (d: Date, t: Date) => {
    const combined = new Date(d);
    combined.setHours(t.getHours(), t.getMinutes(), 0, 0);
    return combined;
  };

  const handleToggleTag = async (tagId: number) => {
    const isSelected = selectedTagIds.includes(tagId);
    if (eventToEdit) {
      if (isSelected) {
        await removeTagFromEvent(eventToEdit.id, tagId);
      } else {
        await assignTagToEvent(eventToEdit.id, tagId);
      }
    }
    setSelectedTagIds((prev) =>
      isSelected ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleDeleteTag = async (tagId: number) => {
    if (eventToEdit && selectedTagIds.includes(tagId)) {
      await removeTagFromEvent(eventToEdit.id, tagId);
    }
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    await removeTag(tagId);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter an event title.');
      return;
    }

    const startDateTime = combineDateAndTime(date, startTime);
    const endDateTime = hasEndTime ? combineDateAndTime(date, endTime) : null;

    if (endDateTime && endDateTime <= startDateTime) {
      Alert.alert('Invalid end time', 'End time must be after start time.');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        startTime: format(startDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
        endTime: endDateTime ? format(endDateTime, "yyyy-MM-dd'T'HH:mm:ss") : null,
        location: location.trim() || null,
      };

      if (eventToEdit) {
        await updateEvent(eventToEdit.id, payload);
      } else {
        const created = await addEvent(payload);
        if (created && selectedTagIds.length > 0) {
          for (const tagId of selectedTagIds) {
            await assignTagToEvent(created.id, tagId);
          }
        }
      }

      resetForm();
      onEventCreated();
      if (onClose) onClose();
      sheetRef.current?.close();
    } catch (err) {
      console.error('Failed to save event:', err);
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface }}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      onClose={() => {
        if (!eventToEdit) resetForm();
        if (onClose) onClose();
      }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        {!eventToEdit && onSwitchType && <AddTypeSwitcher active="Event" onSelect={onSwitchType} />}
        <Text style={styles.titleText}>{eventToEdit ? 'Edit Event' : 'New Event'}</Text>

        <BottomSheetTextInput
          style={styles.input}
          placeholder="Enter Event Here"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.row}>
          <Text style={styles.label}>Date:</Text>
          <Pressable onPress={() => setShowDatePicker(true)} style={styles.pickerPressable}>
            <Text style={styles.pickerText}>{format(date, 'EEE, MMM d')}</Text>
          </Pressable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_: DateTimePickerEvent, selected?: Date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selected) setDate(selected);
            }}
          />
        )}

        <View style={styles.row}>
          <Text style={styles.label}>Start time:</Text>
          <Pressable onPress={() => setShowStartTimePicker(true)} style={styles.pickerPressable}>
            <Text style={styles.pickerText}>{format(startTime, 'HH:mm')}</Text>
          </Pressable>
        </View>

        {showStartTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_: DateTimePickerEvent, selected?: Date) => {
              setShowStartTimePicker(Platform.OS === 'ios');
              if (selected) setStartTime(selected);
            }}
          />
        )}

        <View style={styles.row}>
          <Text style={styles.label}>End time:</Text>
          <Pressable
            onPress={() => setHasEndTime((prev) => !prev)}
            style={[styles.toggleChip, hasEndTime && styles.toggleChipActive]}
          >
            <Text style={hasEndTime ? styles.toggleChipTextActive : styles.toggleChipText}>
              {hasEndTime ? 'On' : 'Off'}
            </Text>
          </Pressable>
        </View>

        {hasEndTime && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Ends at:</Text>
              <Pressable onPress={() => setShowEndTimePicker(true)} style={styles.pickerPressable}>
                <Text style={styles.pickerText}>{format(endTime, 'HH:mm')}</Text>
              </Pressable>
            </View>

            {showEndTimePicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_: DateTimePickerEvent, selected?: Date) => {
                  setShowEndTimePicker(Platform.OS === 'ios');
                  if (selected) setEndTime(selected);
                }}
              />
            )}
          </>
        )}

        <BottomSheetTextInput
          style={[styles.input, { marginTop: 12 }]}
          placeholder="Location (optional)"
          placeholderTextColor={colors.textPlaceholder}
          value={location}
          onChangeText={setLocation}
        />

        <View style={styles.dynamicContainer}>
          <Text style={styles.subSectionTitle}>Tags</Text>
          <TagPicker
            allTags={allTags}
            mostUsedTags={mostUsedTags}
            selectedTagIds={selectedTagIds}
            onToggleTag={handleToggleTag}
            onCreateTag={(name) => addTag({ name })}
            onDeleteTag={handleDeleteTag}
          />
        </View>

        <View style={{ marginTop: 24, width: '100%', paddingBottom: 40 }}>
          <Pressable
            disabled={!title.trim()}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              !title.trim() && styles.submitButtonDisabled,
              pressed && title.trim() ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={styles.submitButtonText}>{eventToEdit ? 'Update Event' : 'Add Event'}</Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: { padding: 24 },
  titleText: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20, color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: colors.surfaceSubtle, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
  label: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  pickerPressable: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceSubtle },
  pickerText: { fontSize: 15, color: colors.textPrimary },
  toggleChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.surfaceSubtle },
  toggleChipActive: { borderColor: colors.eventAccent, backgroundColor: colors.selectedBg },
  toggleChipText: { fontSize: 13, color: colors.textSecondary },
  toggleChipTextActive: { fontSize: 13, color: colors.eventAccent, fontWeight: '600' },
  dynamicContainer: { marginTop: 10, padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  subSectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  submitButton: { backgroundColor: colors.eventAccent, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.surfaceElevated },
  submitButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
});