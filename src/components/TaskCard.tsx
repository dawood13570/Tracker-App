// src/components/TaskCard.tsx
import { getEffectivePriority } from '@/engine/priority';
import { Alert, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useStore } from '../store/useStore';
import { ProcrastinationBadge } from './ProcrastinationBadge';
import { ProgressBar } from './ProgressBar';

export interface Task {
  id: number;
  title: string;
  type: 'Simple' | 'Progression' | 'Hybrid';
  priority: 'Low' | 'Medium' | 'High';
  isCompleted: boolean;

  currentProgress?: number | null;
  totalProgress?: number | null;
  progressUnit?: string | null;
  deadline?: string | null;

  subtasksCompleted?: number | null;
  subtasksTotal?: number | null;
  procrastinationCount?: number | null;
  rolloverEnabled?: boolean | null;
  recurrenceType? : 'none' | 'daily' | 'every_n_days' | 'weekly' | string | null;
  recurrenceInterval?: number | null;
  recurrenceDaysOfWeek?: string | null;
}

interface TaskCardProps {
    task: Task;
    onToggle: (id: number, currentStatus: boolean) => void;
    onEdit: (task: Task) => void;
    onDelete: (id: number) => void;
    currentProgress?: number;
    onOpenProgressLog?: (task: Task) => void;
}

export function TaskCard({ task, onToggle, onEdit, onDelete, currentProgress, onOpenProgressLog }: TaskCardProps) {
    const { evolvingPriorityEnabled } = useStore();

    const effectivePriority = evolvingPriorityEnabled
      ? getEffectivePriority({
          priority: task.priority,
          procrastinationCount: task.procrastinationCount ?? 0,
        })
      : task.priority;

    const displayedProgress = currentProgress ?? task.currentProgress ?? 0;
    

    const handleLongPress = () => {
      Alert.alert(
        'Task Options',
        'Choose an action for this task',
        [
          {
            text: 'Edit',
            onPress: () => onEdit(task),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => confirmDelete(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    };

    const confirmDelete = () => {
      Alert.alert(
        'Are you sure?',
        'This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDelete(task.id)
          }
        ],
        { cancelable: true }
      )
    }

    return (
      <Pressable style={[styles.taskCard, task.isCompleted && styles.completedCard]} onPress={() => onToggle(task.id, task.isCompleted)} onLongPress={handleLongPress}>
        <View style={styles.cardRow}>
          <View style={styles.cardContent}>
            <Text style={[styles.taskTitle, task.isCompleted && styles.completedText]}>
              {task.title}
            </Text>
            
            <View style={styles.metaRow}>
              <Text style={styles.taskMeta}>
                {task.isCompleted ? "✅ DONE • " : ""}
                {task.type.toUpperCase()} • <Text style={(!task.isCompleted && effectivePriority === 'High') && styles.highPriorityIncomplete}>{effectivePriority.toUpperCase()}</Text>
              </Text>

              {task.procrastinationCount && task.procrastinationCount > 0 ? (
                <ProcrastinationBadge count={task.procrastinationCount} />
                ) : null}
            </View>

            {task.type === 'Hybrid' && task.subtasksTotal !== null && task.subtasksTotal !== undefined && (
              <View style={styles.hybridBadge}>
                <Text style={styles.hybridBadgeText}>
                  {task.subtasksCompleted || 0}/{task.subtasksTotal} done
                </Text>
              </View>
            )}

            {task.type === 'Progression' && task.totalProgress !== null && task.totalProgress !== undefined && (
              <ProgressBar
              current={displayedProgress}
              target={task.totalProgress}
              unit={task.progressUnit}
              />
            )}
          </View>

          {task.type === 'Hybrid' && (
            <TouchableOpacity style={styles.expandButton} onPress={() => {}}>
              <Text style={styles.arrowIcon}>▼</Text>
            </TouchableOpacity>
          )}

          {task.type === 'Progression' && (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => onOpenProgressLog && onOpenProgressLog(task)}
            >
              <Text style={styles.arrowIcon}>✎</Text>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    );
}


export const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: {
    flex: 1,
  },
  expandButton: {
    paddingLeft: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 14,
    color: '#888888',
  },
  completedCard: {
    backgroundColor: '#d6d6d6',
    shadowOpacity: 0.05,
    elevation: 0.5,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#888'
  },
  highPriorityIncomplete: {
    color: '#d21818',
    fontWeight: '800',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskMeta: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  hybridBadge: {
    marginTop: 8,
    backgroundColor: '#E1F5FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hybridBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0288D1',
  }
});