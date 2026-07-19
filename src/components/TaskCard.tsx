// src/components/TaskCard.tsx
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface Task {
  id: number; // Changed from string to number to match SQLite autoincrement ID keys
  title: string;
  type: 'Simple' | 'Progression' | 'Hybrid';
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;

  currentProgress?: number | null;
  totalProgress?: number | null;
  progressUnit?: string | null;

  subtasksCompleted?: number | null;
  subtasksTotal?: number | null;
  procrastinationCount?: number | null;
}

interface TaskCardProps {
    task: Task;
    onToggle: (id: number, currentStatus: boolean) => void; // Updated parameter contract
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
    const progressRatio = task.totalProgress && task.totalProgress > 0 
      ? (task.currentProgress || 0) / task.totalProgress 
      : 0;

    let progressBarColor = '#4CAF50';
    if (progressRatio < 0.3) {
      progressBarColor = '#F44336';
    } else if (progressRatio < 0.8) {
      progressBarColor = '#FFC107';
    }

    return (
      <Pressable style={[styles.taskCard, task.isCompleted && styles.completedCard]} onPress={() => onToggle(task.id, task.isCompleted)}>
        <View style={styles.cardRow}>
          <View style={styles.cardContent}>
            <Text style={[styles.taskTitle, task.isCompleted && styles.completedText]}>
              {task.title}
            </Text>
            
            <Text style={styles.taskMeta}>
              {task.isCompleted ? "✅ DONE • " : ""}
              {task.type.toUpperCase()} • <Text style={(!task.isCompleted && task.priority === 'high') && styles.highPriorityIncomplete}>{task.priority.toUpperCase()}</Text> {task.procrastinationCount && task.procrastinationCount > 0 ? (
              ` • Procrastinating for ${task.procrastinationCount} day(s)`
              ) : null}
            </Text>

            {task.type === 'Hybrid' && task.subtasksTotal !== null && task.subtasksTotal !== undefined && (
              <View style={styles.hybridBadge}>
                <Text style={styles.hybridBadgeText}>
                  {task.subtasksCompleted || 0}/{task.subtasksTotal} done
                </Text>
              </View>
            )}

            {task.type === 'Progression' && task.totalProgress !== null && task.totalProgress !== undefined && (
              <View style={styles.progressionContainer}>
                <Text style={styles.progressionLabel}>
                  Progress: {task.currentProgress || 0} / {task.totalProgress} {task.progressUnit || ''}
                </Text>
                <View style={styles.progressBarBackground}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { 
                        width: `${Math.min(progressRatio * 100, 100)}%`,
                        backgroundColor: progressBarColor 
                      }
                    ]} 
                  />
                </View>
              </View>
            )}
          </View>

          {task.type === 'Hybrid' && (
            <TouchableOpacity style={styles.expandButton} onPress={() => {}}>
              <Text style={styles.arrowIcon}>▼</Text>
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
  },
  progressionContainer: {
    marginTop: 8,
  },
  progressionLabel: {
    fontSize: 12,
    color: '#444444',
    fontWeight: '500',
    marginBottom: 6,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
});