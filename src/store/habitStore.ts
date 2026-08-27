import { format } from 'date-fns';
import { create } from 'zustand';
import { deleteHabit, getHabitsByDate, HabitWithStatus, insertHabit, logHabitCompletion, updateHabit } from '../db/queries';

export type { HabitWithStatus };

type HabitStore = {
    habits: HabitWithStatus[];
    isLoading: boolean;
    selectedDate: string;
    loadHabits: (date?: string) => Promise<void>;
    logHabit: (habitId: number) => Promise<void>;
    addHabit: (data: { title: string; cadenceType: 'daily' | 'weekly_n_times'; cadenceTarget?: number}) => Promise<void>;
    updateHabit: (id: number, data: Partial<{title: string; cadenceType: 'daily' | 'weekly_n_times'; cadenceTarget: number | null }>) => Promise<void>;
    removeHabit: (id: number) => Promise<void>;
};

export const useHabitStore = create<HabitStore>((set, get) => ({
    habits: [],
    isLoading: false,
    selectedDate: format(new Date(), 'yyyy-MM-dd'),

    loadHabits: async (date) => {
        const targetDate = date ?? get().selectedDate;
        set({ isLoading: true, selectedDate: targetDate });
        const habits = await getHabitsByDate(targetDate);
        set({ habits, isLoading: false });
    },

    logHabit: async (habitId) => {
        const { selectedDate } = get();
        await logHabitCompletion(habitId, selectedDate);

        await get().loadHabits(selectedDate);
    },

    addHabit: async (data: { title: string, cadenceType: 'daily' | 'weekly_n_times'; cadenceTarget?: number}) => {
        await insertHabit(data);
        await get().loadHabits();
    },

    updateHabit: async (id, data) => {
        await updateHabit(id, data);
        await get().loadHabits();
    },

    removeHabit: async (id) => {
        await deleteHabit(id);
        await get().loadHabits();
    }
}));