import { InferInsertModel, InferSelectModel, eq } from 'drizzle-orm';
import { create } from 'zustand';
import { db } from '../db/client';
import { tasks as tasksTable } from '../db/schema';
import { getLocalDateString } from '../utils/date';

export type Task = InferSelectModel<typeof tasksTable>;
export type NewTask = InferInsertModel<typeof tasksTable>;

interface TaskState {
    tasks: Task[];
    isLoading: boolean;
    selectedDate: string;

    setSelectedDate: (date: string) => void;

    loadTasks: (date?: string) => Promise<void>;
    addTask: (newTask: NewTask) => Promise<Task | null>;
    updateTask: (id: number, update: Partial<Task>) => Promise<void>;
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
            const [insertedTask] = await db
                .insert(tasksTable)
                .values(newTaskData)
                .returning();
            
            if (insertedTask && insertedTask.scheduledDate === get().selectedDate) {
                set((state) => ({ tasks: [...state.tasks, insertedTask] }));
            }

            return insertedTask ?? null;
        } catch (error) {
            console.error('Failed to add task:', error);
            return null;
        }
    },

    updateTask: async (id: number, updates: Partial<Task>) => {
        try {
            const [updatedTask] = await db
                .update(tasksTable)
                .set({
                    ...updates,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(tasksTable.id, id))
                .returning();
            
            if (updatedTask) {
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                    task.id === id ? updatedTask : task
                ),
                }));
            }
        } catch (error) {
            console.error("Failed to update task ${id}:", error)
        }
    },

    removeTask: async (id: number) => {
        try {
            await db.delete(tasksTable).where(eq(tasksTable.id, id));

            set((state) => ({
                tasks: state.tasks.filter((task) => task.id !== id),
            }));
        } catch (error) {
            console.error("Failed to remove task ${id}:", error);
        }
    },   
}));