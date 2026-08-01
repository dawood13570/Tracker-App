const ESCALATION_STEP_DAYS = 4; // days of procrastination per priority level climbed

const PRIORITY_ORDER: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];

interface PriorityInput {
  priority: 'Low' | 'Medium' | 'High';
  procrastinationCount: number;
}

/**
 * Computes the priority a task should be TREATED as for sorting/display,
 * without ever touching the stored `priority` column. The user's original
 * priority choice is never overwritten — this is purely a display-time
 * computation, so toggling the feature off requires no data migration.
 */
export function getEffectivePriority(task: PriorityInput): 'Low' | 'Medium' | 'High' {
  const currentIndex = PRIORITY_ORDER.indexOf(task.priority);
  const stepsClimbed = Math.floor(task.procrastinationCount / ESCALATION_STEP_DAYS);
  const newIndex = Math.min(currentIndex + stepsClimbed, PRIORITY_ORDER.length - 1);

  return PRIORITY_ORDER[newIndex];
}