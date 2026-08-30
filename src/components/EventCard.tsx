import { EventRow } from "@/store/eventStore";
import { colors } from "@/theme/colors";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

type EventCardProps = {
    event: EventRow;
    onEdit: (event: EventRow) => void;
    onDelete: (eventId: number) => void;
};

function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { hour: '2-digit', minute: '2-digit'});
}

export function EventCard({ event, onEdit, onDelete }: EventCardProps) {
    const  handleLongPress = () => {
        Alert.alert(
            'Event Options',
            'Chosse an action for this event',
            [
                { text: 'Edit', onPress: () => onEdit(event) },
                { text: 'Delete', style: 'destructive', onPress: () => confirmDelete() },
                { text: 'Cancel', style: 'cancel'},
            ],
            { cancelable: true }
        );
    };

    const confirmDelete = () => {
        Alert.alert(
            'Are you sure?',
            'This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(event.id)},
            ],
            { cancelable: true }
        );
    };

    return (
        <Pressable
          onLongPress={handleLongPress}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.leftAccent} />

            <View style={styles.timeColumn}>
                <Text style={styles.timeText}>{formatTime(event.startTime)}</Text>
                {event.endTime && <Text style={styles.timeTextSecondary}>{formatTime(event.endTime)}</Text>}
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>{event.title}</Text>
                {event.location && <Text style={styles.location}>{event.location}</Text>}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginVertical: 6,
    paddingVertical: 12,
    paddingRight: 14,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
  },
  leftAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.eventAccent,
    marginRight: 12,
  },
  timeColumn: {
    width: 56,
    alignItems: 'flex-start',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  timeTextSecondary: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  content: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  location: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
});