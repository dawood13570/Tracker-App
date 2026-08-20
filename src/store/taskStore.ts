import { getNextOccurrence } from '@/engine/recurrence';
import { InferSelectModel } from 'drizzle-orm';
import { create, type StoreApi } from 'zustand';
import { deleteTask, getTaskByDate, insertTask, NewTask, toggleTaskStatus, updateTask, UpdateTask as UpdateTaskQuery } from '../db/queries';
import { tasks as tasksTable } from '../db/schema';
import { getLocalDateString } from '../utils/date';

export type Task = InferSelectModel<typeof tasksTable>;
export type { NewTask };

interface TaskState {
    tasks: Task[];
    isLoading: boolean;
    selectedDate: string;

    setSelectedDate: (date: string) => void;

    loadTasks: (date?: string) => Promise<void>;
    addTask: (newTask: NewTask) => Promise<Task | null>;
    updateTask: (id: number, update: UpdateTaskQuery) => Promise<void>;
    toggleTask: (id: number) => Promise<void>;
    completeTask: (id: number) => Promise<void>;
    removeTask: (id: number) => Promise<void>;
}

// Shared by both toggleTask and completeTask — whenever a task lands on
// isCompleted: true, this checks whether it recurs and, if so, spawns the
// next occurrence. Kept as one function so completing a task via the
// checkbox and completing it via hitting a Progression target both
// correctly continue the recurrence chain, instead of one silently
// skipping it. A plain function (not a store action) since it's an
// internal implementation detail, not something a screen should ever
// call directly.
async function handleCompletionSideEffects(
    get: StoreApi<TaskState>['getState'],
    updated: Task
) {
    if (updated.isCompleted && updated.recurrenceType !== 'none') {
        const nextDate = getNextOccurrence(
            { ...updated, recurrenceType: updated.recurrenceType as 'daily' | 'every_n_days' | 'weekly' },
            new Date()
        );

        if (nextDate) {
            const {
                id: _id,
                createdAt: _createdAt,
                updatedAt: _updatedAt,
                ...taskData
            } = updated;

            const newTaskPayload: NewTask = {
                ...(taskData as NewTask),
                scheduledDate: getLocalDateString(nextDate),
                isCompleted: false,
                procrastinationCount: 0,
                currentProgress: 0,
                subtasksCompleted: 0,
            };
            await get().addTask(newTaskPayload);
        }
    }
}

export const useTaskStore = create<TaskState>((set, get) => ({
    tasks: [],
    isLoading: false,
    selectedDate: getLocalDateString(),

    setSelectedDate: (date: string) => {
        set({ selectedDate: date });
        get().loadTasks(date);
    },

    loadTasks: async (date?: string) => {
        const targetDate = date ?? get().selectedDate;
        set({ isLoading: true });

        try {
            const result = await getTaskByDate(targetDate);

            set({ tasks: result });
        } catch (error) {
            console.error('Failed to load tasks', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addTask: async (newTaskData: NewTask) => {
        try {
            const inserted = await insertTask(newTaskData);


            if (inserted && inserted.scheduledDate === get().selectedDate) {
                set((state) => ({ tasks: [...state.tasks, inserted] }));
            }

            return inserted ?? null;
        } catch (error) {
            console.error('Failed to add task:', error);
            return null;
        }
    },

    updateTask: async (id: number, updates: UpdateTaskQuery) => {
        try {
            const updated = await updateTask(id, updates);


            if (updated) {
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                    task.id === id ? updated : task
                ),
                }));
            }
        } catch (error) {
            console.error(`Failed to update task ${id}:`, error)
        }
    },

    toggleTask: async (id: number) => {
        try {
            const updated = await toggleTaskStatus(id);

            if (updated) {
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                        task.id === id ? updated : task
                    ),
                }));

                await handleCompletionSideEffects(get, updated);
            }
        } catch (error) {
            console.error(`Failed to toggle task ${id}`, error);
        }
    },
    
    completeTask: async (id: number) => {
        try {
            const updated = await updateTask(id, { isCompleted: true });

            if (updated) {
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                        task.id === id ? updated : task
                    ),
                }));

                await handleCompletionSideEffects(get, updated);
            }
        } catch (error) {
            console.error(`Failed to complete task ${id}`, error);
        }
    },

    removeTask: async (id: number) => {
        try {
            await deleteTask(id);

            set((state) => ({
                tasks: state.tasks.filter((task) => task.id !== id),
            }));
        } catch (error) {
            console.error(`Failed to remove task ${id}:`, error);
        }
    },
}));