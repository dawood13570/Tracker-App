import { format, parseISO, startOfWeek, subDays, subWeeks } from 'date-fns';

type Habit = {
    cadenceType: 'daily' | 'weekly_n_times';
    cadenceTarget: number | null;
};

export function calculateHabitStreak(
    habit: Habit,
    logDates: string[],
    today: string
): number {
    const logSet = new Set(logDates);

    if (habit.cadenceType === 'daily') {
        let cursor = logSet.has(today) ? parseISO(today) : subDays(parseISO(today), 1);
        let streak = 0;

        while (logSet.has(format(cursor, 'yyyy-MM-dd'))) {
            streak++;
            cursor = subDays(cursor, 1);
        }

        return streak;
    }

    const target = habit.cadenceTarget ?? 0;
    if (target <= 0 ) return 0;

    const countInWeek = (weekStart: Date): number => {
        const weekEnd = subDays(subWeeks(weekStart, -1), 1);
        let count = 0;
        for (const d of logSet) {
            const parsed = parseISO(d);
            if (parsed >= weekStart && parsed <= weekEnd) count++;
        }
        return count;
    };

    const currentWeekStart = startOfWeek(parseISO(today), {weekStartsOn: 1});
    let cursor = currentWeekStart;
    let streak = 0;

    if (countInWeek(cursor) >= target) {
        streak = 1;
    }
    cursor = subWeeks(cursor, 1);

    while (countInWeek(cursor) >= target) {
        streak++;
        cursor = subWeeks(cursor, 1);
    }

    return streak;
}