import { EventRow } from '@/store/eventStore';
import { colors } from '@/theme/colors';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SelectionIndicator } from './SelectionIndicator';

type EventCardProps = {
  event: EventRow;
  selectionMode?: boolean;
  isSelected?: boolean;
  onLongPressCard?: () => void;
  onToggleSelect?: () => void;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function EventCard({
  event,
  selectionMode = false,
  isSelected = false,
  onLongPressCard,
  onToggleSelect,
}: EventCardProps) {
  const handlePress = () => {
    if (selectionMode) {
      onToggleSelect?.();
    }
  };

  const handleLongPress = () => {
    if (!selectionMode && onLongPressCard) {
      onLongPressCard();
    }
  };

  return (
    <View style={[styles.card, isSelected && styles.cardSelected]} collapsable={false}>
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={({ pressed }) => [styles.pressableContainer, pressed && styles.cardPressed]}
      >
        <View style={styles.leftAccent} />

        <View style={styles.leadSlot}>
          {selectionMode ? (
            <SelectionIndicator isSelected={isSelected} />
          ) : (
            <View style={styles.leadPlaceholder} />
          )}
        </View>

        <View style={styles.timeColumn}>
          <Text style={styles.timeText}>{formatTime(event.startTime)}</Text>
          {event.endTime && <Text style={styles.timeTextSecondary}>{formatTime(event.endTime)}</Text>}
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{event.title}</Text>
          {event.location && <Text style={styles.location}>{event.location}</Text>}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginVertical: 6,
    minHeight: 56,
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pressableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 56,
    paddingVertical: 12,
    paddingRight: 14,
  },
  cardPressed: { opacity: 0.85 },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.selectedBg ?? colors.surface,
  },
  leftAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.eventAccent,
    marginRight: 12,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  leadSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  leadPlaceholder: {
    width: 20,
    height: 20,
  },
  timeColumn: { width: 56, alignItems: 'flex-start' },
  timeText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  timeTextSecondary: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  content: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  location: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});