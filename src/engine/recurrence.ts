import { addDays, getDay } from 'date-fns';

interface RecurrenceInput {
    recurrenceType: 'none' | 'daily' | 'every_n_days' | 'weekly';
    recurrenceInterval: number | null;
    recurrenceDaysOfWeek: string | null;
}

const DAY_MAP: Record<string, number> = {
                sun: 0,
                mon: 1,
                tue: 2,
                wed: 3,
                thu: 4,
                fri: 5,
                sat: 6,
            };

export function getNextOccurrence(task: RecurrenceInput, fromDate: Date): Date | null {
    switch (task.recurrenceType) {
        case 'daily':
            return addDays(fromDate, 1);

        case 'every_n_days':
            return addDays(fromDate, task.recurrenceInterval ?? 1);

        case 'weekly': {
            if (!task.recurrenceDaysOfWeek) return null;

            let targetDays: number[] = [];
            try {
                const parsed = JSON.parse(task.recurrenceDaysOfWeek) as string[];
                targetDays = parsed
                .map((day) => DAY_MAP[day.toLowerCase()])
                .filter((d): d is number => d !== undefined);  
            } catch {
                return null;
            }

            if (targetDays.length === 0) return null;

            for (let offset = 1; offset <= 7; offset++) {
                const candidateDate = addDays(fromDate, offset);
                const candidateDay = getDay(candidateDate);

                if (targetDays.includes(candidateDay)) {
                    return candidateDate;
                }
            }

            return null;
        }

        case 'none':
        default:
            return null;
    }
}