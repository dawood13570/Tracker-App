import { addDays, differenceInCalendarDays, parseISO, format } from 'date-fns';
export type PlannedDay = { date: string; target: number; done: number; covered: number; work: number; rest: boolean; locked: boolean };
export type QuantityPlanInput = {
  start: string; end: string; today: string; total: number; done: number;
  baseline: number; mode: string | null; progressByDate: Record<string, number>;
  lockedTargets: Record<string, number>; restDates: Set<string>;
  credits?: { date: string; amount: number }[]; spent?: number;
};
const round = (value: number) => Math.round(value * 1e8) / 1e8;
/** Real work plus unapplied bank coverage is the planning budget. Coverage never increments real work. */
export function projectQuantity(input: QuantityPlanInput): PlannedDay[] {
  const start = input.today > input.start ? input.today : input.start;
  if (start > input.end) return [];
  const count = differenceInCalendarDays(parseISO(input.end), parseISO(start)) + 1;
  if (!Number.isFinite(count) || count > 36600) throw new Error('Choose a goal range of at most 100 years.');
  const dates = Array.from({ length: count }, (_, i) => format(addDays(parseISO(start), i), 'yyyy-MM-dd'));
  const credits = input.credits ?? [];
  let used = input.spent ?? 0;
  let remaining = Math.max(0, input.total - input.done);
  const bank = remaining > 0 ? Math.max(0, credits.reduce((n, c) => n + c.amount, 0) - used) : 0;
  let freeBudget = Math.max(0, remaining + bank - dates.reduce((n, date) => n + (input.restDates.has(date) ? 0 : Math.max(0, (input.lockedTargets[date] ?? 0) - (input.progressByDate[date] ?? 0))), 0));
  let freeDays = dates.filter(date => !input.restDates.has(date) && input.lockedTargets[date] == null).length;
  const elapsed = differenceInCalendarDays(parseISO(start), parseISO(input.start));
  const phase = elapsed * input.baseline;
  let roundingRemainder = phase - Math.ceil(phase - 1e-8);
  return dates.map((date, index) => {
    const done = Math.max(0, input.progressByDate[date] ?? 0);
    const rest = input.restDates.has(date);
    const locked = input.lockedTargets[date] != null;
    const floor = input.baseline * (input.mode === 'breathing_room' ? 0.5 : 1);
    const ideal = Math.max(freeBudget / Math.max(1, freeDays), floor);
    const apportioned = Math.max(0, Math.ceil(ideal + roundingRemainder - 1e-8));
    let quota = locked ? Math.max(0, input.lockedTargets[date] - done) : Math.min(freeBudget, freeDays === 1 ? freeBudget : apportioned);
    if (!locked && !rest) roundingRemainder += ideal - quota;
    else { const nextPhase = (elapsed + index + 1) * input.baseline; roundingRemainder = nextPhase - Math.ceil(nextPhase - 1e-8); }
    if (rest) quota = 0;
    else if (!locked) { freeBudget = Math.max(0, freeBudget - quota); freeDays--; }
    // Surplus earned today becomes available on the next day, never on its own earning task.
    const available = input.total > input.done ? Math.max(0, credits.filter(c => c.date < date).reduce((n, c) => n + c.amount, 0) - used) : 0;
    const covered = round(Math.min(quota, available)); used += covered;
    const work = round(Math.min(remaining, Math.max(0, quota - covered)));
    remaining = round(Math.max(0, remaining - work));
    return { date, target: locked ? input.lockedTargets[date] : round(done + covered + work), done, covered, work, rest, locked };
  });
}
