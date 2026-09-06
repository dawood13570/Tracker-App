import { create } from 'zustand';
import {
  deleteHabit,
  getHabitsByDate,
  HabitWithStatus,
  insertHabit,
  logHabitCompletion,
  updateHabit,
} from '../db/queries';
import { getLocalDateString } from '../utils/date';

export type { HabitWithStatus };

export interface NewHabitPayload {
    title: string;
    cadenceType: 'daily' | 'weekly_n_times';
    cadenceTarget?: number;
}

interface HabitState {
    habits: HabitWithStatus[];
    isLoading: boolean;
    selectedDate: string;

    setSelectedDate: (date: string) => void;
    loadHabits: (date?: string) => Promise<void>;
    addHabit: (data: NewHabitPayload) => Promise<HabitWithStatus | null>;
    updateHabit: (
        id: number,
        data: Partial<{
            title: string;
            cadenceType: 'daily' | 'weekly_n_times';
            cadenceTarget: number | null;
        }>
    ) => Promise<void>;
    logHabit: (id: number) => Promise<void>;
    removeHabit: (id: number) => Promise<void>;
}

// Global write queue to serialize SQLite operations and prevent locking/overlapping writes
let writeQueue: Promise<any> = Promise.resolve();

const enqueueWrite = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.catch(() => {}); // Prevents queue blockage if an operation fails
    return result;
};

export const useHabitStore = create<HabitState>((set, get) => ({
    habits: [],
    isLoading: false,
    selectedDate: getLocalDateString(),

    setSelectedDate: (date: string) => {
        set({ selectedDate: date });
        get().loadHabits(date);
    },

    loadHabits: async (date?: string) => {
        const targetDate = date ?? get().selectedDate;
        set({ isLoading: true });
        try {
            const data = await getHabitsByDate(targetDate);
            set({ habits: data });
        } catch (error) {
            console.error('Failed to load habits:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addHabit: async (data: NewHabitPayload) => {
        return enqueueWrite(async () => {
            try {
                const [inserted] = await insertHabit(data);
                if (inserted) {
                    await get().loadHabits();
                    const freshList = get().habits;
                    const matching = freshList.find((h) => h.id === inserted.id);
                    return matching ?? (inserted as unknown as HabitWithStatus);
                }
                return null;
            } catch (error) {
                console.error('Failed to add habit:', error);
                return null;
            }
        });
    },

    updateHabit: async (id: number, data) => {
        return enqueueWrite(async () => {
            try {
                await updateHabit(id, data);
                await get().loadHabits();
            } catch (error) {
                console.error(`Failed to update habit ${id}:`, error);
            }
        });
    },

    logHabit: async (id: number) => {
        return enqueueWrite(async () => {
            try {
                const today = get().selectedDate;
                await logHabitCompletion(id, today);
                await get().loadHabits();
            } catch (error) {
                console.error(`Failed to log habit ${id}:`, error);
            }
        });
    },

    removeHabit: async (id: number) => {
        return enqueueWrite(async () => {
            try {
                await deleteHabit(id);
                set((state) => ({
                    habits: state.habits.filter((h) => h.id !== id),
                }));
            } catch (error) {
                console.error(`Failed to remove habit ${id}:`, error);
            }
        });
    },
}));