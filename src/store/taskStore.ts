// src/store/taskStore.ts
import { getNextOccurrence } from '@/engine/recurrence';
import { InferSelectModel } from 'drizzle-orm';
import { create, type StoreApi } from 'zustand';
import {
  deleteTask,
  getSubtasksByParent,
  getTaskByDate,
  insertSubtask,
  insertTask,
  NewTask,
  setAllSubtasksStatus,
  toggleTaskStatus,
  updateTask,
  UpdateTask as UpdateTaskQuery,
} from '../db/queries';
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
  uncompleteTask: (id: number) => Promise<void>;
  removeTask: (id: number) => Promise<void>;
  updateProgress: (id: number, currentProgress: number) => Promise<void>;
}

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
      const { id: oldId, createdAt: _c, updatedAt: _u, ...taskData } = updated;
      const scheduledDateStr = getLocalDateString(nextDate);

      const newTaskPayload: NewTask = {
        ...(taskData as NewTask),
        scheduledDate: scheduledDateStr,
        isCompleted: false,
        procrastinationCount: 0,
        currentProgress: 0,
        subtasksCompleted: 0,
      };

      const newParent = await get().addTask(newTaskPayload);

      if (newParent && updated.type === 'Hybrid') {
        const existingSubtasks = await getSubtasksByParent(oldId);
        for (const sub of existingSubtasks) {
          await insertSubtask(newParent.id, {
            title: sub.title,
            type: sub.type,
            priority: sub.priority,
            scheduledDate: scheduledDateStr,
            isCompleted: false,
          });
        }
      }
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

      if (inserted && inserted.scheduledDate === get().selectedDate && !inserted.parentId) {
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
          tasks: state.tasks.map((task) => (task.id === id ? updated : task)),
        }));
      }
    } catch (error) {
      console.error(`Failed to update task ${id}:`, error);
    }
  },

  toggleTask: async (id: number) => {
    try {
      const updated = await toggleTaskStatus(id);

      if (updated) {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? updated : task)),
        }));

        if (updated.type === 'Hybrid' && updated.parentId == null) {
          await setAllSubtasksStatus(updated.id, updated.isCompleted);
        }

        if (updated.parentId != null) {
          const siblings = await getSubtasksByParent(updated.parentId);
          const allSiblingsCompleted = siblings.length > 0 && siblings.every((s) => s.isCompleted);

          if (allSiblingsCompleted) {
            await get().completeTask(updated.parentId);
          } else {
            await get().uncompleteTask(updated.parentId);
          }
        }

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
          tasks: state.tasks.map((task) => (task.id === id ? updated : task)),
        }));

        await handleCompletionSideEffects(get, updated);
      }
    } catch (error) {
      console.error(`Failed to complete task ${id}`, error);
    }
  },

  uncompleteTask: async (id: number) => {
    try {
      const updated = await updateTask(id, { isCompleted: false });

      if (updated) {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? updated : task)),
        }));
      }
    } catch (error) {
      console.error(`Failed to uncomplete task ${id}`, error);
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

  updateProgress: async (id: number, currentProgress: number) => {
    try {
      const updated = await updateTask(id, { currentProgress });
      if (updated) {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? updated : task)),
        }));
      }
    } catch (error) {
      console.error(`Failed to update progress for task ${id}:`, error);
    }
  },
}));

