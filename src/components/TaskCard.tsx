import { StyleSheet, Text, View } from 'react-native';

export interface Task {
  id: string;
  title: string;
  type: 'simple' | 'progression' | 'hybrid';
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;

  current_progress?: number;
  total_progress?: number;
  progress_unit?: string;

  subtasks_completed?: number;
  subtasks_total?: number;
  
  procrastination_count?: number;
}

interface TaskCardProps {
    task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
    const progressRatio = task.total_progress && task.total_progress > 0 
      ? (task.current_progress || 0) / task.total_progress 
      : 0;
return (
         <View style={[styles.taskCard, task.isCompleted && styles.completedCard]}>
            <Text style={[styles.taskTitle, task.isCompleted && styles.completedText]}>{task.title}</Text>
            
            <Text style={styles.taskMeta}>
                {task.isCompleted ? "✅ DONE • " : ""}
                {task.type.toUpperCase()} • <Text style={(!task.isCompleted && task.priority === 'high') && styles.highPriorityIncomplete}>{task.priority.toUpperCase()}</Text> {task.procrastination_count && task.procrastination_count > 0 ? (
                ` • Procrastinating for ${task.procrastination_count} day(s)`
                ) : null}
            </Text>

            {/* [1.3.4] Hybrid task target indicator label */}
            {task.type === 'hybrid' && task.subtasks_total !== undefined && (
              <View style={styles.hybridBadge}>
                <Text style={styles.hybridBadgeText}>
                  {task.subtasks_completed || 0}/{task.subtasks_total} done
                </Text>
              </View>
            )}

            {/* [1.3.3] Progression task label & thin progress bar container */}
            {task.type === 'progression' && task.total_progress !== undefined && (
              <View style={styles.progressionContainer}>
                <Text style={styles.progressionLabel}>
                  Progress: {task.current_progress || 0} / {task.total_progress} {task.progress_unit || ''}
                </Text>
                <View style={styles.progressBarBackground}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(progressRatio * 100, 100)}%` }]} />
                </View>
              </View>
            )}
         </View>
    )
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
  // New styles for Progression indicators layout
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
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
})