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

interface ArchiveCheckInput {
  id: number;
  priority: 'Low' | 'Medium' | 'High';
  procrastinationCount: number;
}

/**
 * A task gets archived (hidden from Today) only if:
 * 1. It is itself still effectively Low (hasn't evolved) — Medium/High tasks
 *    are never archived, they earned their own visibility.
 * 2. Some OTHER task in the list genuinely EVOLVED to High — started as
 *    Low or Medium and climbed there via procrastination. A task that was
 *    already High to begin with does NOT trigger archiving; only a
 *    low-turned-high task does (per VISION.md).
 *
 * This needs no "how long has it been archived" tracking — since it's
 * recomputed fresh every render from live procrastinationCount, it
 * naturally stays true every day until the evolved task is completed
 * (which resets its procrastinationCount to 0), and naturally stops being
 * true the moment that happens. Nothing to persist.
 */
export function shouldArchiveTask(
  task: ArchiveCheckInput,
  allTasks: ArchiveCheckInput[]
): boolean {
  const taskEffective = getEffectivePriority(task);
  if (taskEffective !== 'Low') return false;

  return allTasks.some((other) => {
    if (other.id === task.id) return false;
    if (other.priority === 'High') return false; // must have evolved, not started High
    return getEffectivePriority(other) === 'High';
  });
}