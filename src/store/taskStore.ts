import { eq, InferSelectModel } from 'drizzle-orm';
import { create } from 'zustand';
import { db } from '../db/client';
import { deleteTask, insertTask, NewTask, toggleTaskStatus, updateTask, UpdateTask as UpdateTaskQuery } from '../db/queries';
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
    updateTask: (id: number, update: Partial<Task>) => Promise<void>;
    toggleTask: (id: number) => Promise<void>;
    removeTask: (id: number) => Promise<void>;
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
            const result = await db
                .select()
                .from(tasksTable)
                .where(eq(tasksTable.scheduledDate, targetDate));
            
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
            console.error("Failed to update task ${id}:", error)
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
        }
    } catch (error) {
        console.error("Failed to toggle task ${id}", error);
      }
    },

    removeTask: async (id: number) => {
        try {
            await deleteTask(id);

            set((state) => ({
                tasks: state.tasks.filter((task) => task.id !== id),
            }));
        } catch (error) {
            console.error("Failed to remove task ${id}:", error);
        }
    },   
}));