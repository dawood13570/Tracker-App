// src/store/taskStore.ts
import { getNextOccurrence } from '@/engine/recurrence';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { InferSelectModel } from 'drizzle-orm';
import { create, type StoreApi } from 'zustand';
import {
  deleteTask,
  ensureDailyDecompositionForDate,
  getSubtasksByParent,
  getTaskByDate,
  getTaskById,
  insertSubtask,
  insertTask,
  NewTask,
  setAllSubtasksStatus,
  toggleTaskStatus,
  updateTask,
  UpdateTask as UpdateTaskQuery
} from '../db/queries';
import { tasks as tasksTable } from '../db/schema';
import { getAppToday, getLocalDateString } from '../utils/date';

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
}

async function handleCompletionSideEffects(
  get: StoreApi<TaskState>['getState'],
  updated: Task
) {
  if (updated.isCompleted && updated.recurrenceType !== 'none' && !updated.nextOccurrenceGenerated) {
    const nextDate = getNextOccurrence(
      { ...updated, recurrenceType: updated.recurrenceType as 'daily' | 'every_n_days' | 'weekly' },
      new Date()
    );

    if (nextDate) {
      const { id: oldId, createdAt: _c, updatedAt: _u, ...taskData } = updated;
      const scheduledDateStr = getLocalDateString(nextDate);

      let newDeadline: string | null = updated.deadline ?? null;
      if (updated.deadline) {
        const deltaDays = differenceInCalendarDays(parseISO(updated.deadline), parseISO(updated.scheduledDate));
        newDeadline = getLocalDateString(addDays(nextDate, deltaDays));
      }

      const newTaskPayload: NewTask = {
        ...(taskData as NewTask),
        scheduledDate: scheduledDateStr,
        deadline: newDeadline,
        isCompleted: false,
        procrastinationCount: 0,
        currentProgress: 0,
        subtasksCompleted: 0,
        nextOccurrenceGenerated: false,
      };

      const newParent = await get().addTask(newTaskPayload);

      if (newParent) {
        const existingSubtasks = await getSubtasksByParent(oldId);
        for (const sub of existingSubtasks) {
          await insertSubtask(newParent.id, {
            title: sub.title,
            type: sub.type,
            priority: sub.priority,
            scheduledDate: scheduledDateStr,
            isCompleted: false,
            totalProgress: sub.totalProgress,   
            progressUnit: sub.progressUnit,
          });
        }
      }
    }
  }
}

// in src/store/taskStore.ts

async function syncMilestoneFromProxy(get: StoreApi<TaskState>['getState'], proxy: Task) {
  if (proxy.sourceTaskId == null) return;
  const source = await getTaskById(proxy.sourceTaskId);
  if (!source) return;

  // Case A: Proxy points to a milestone (which itself has a parent goal)
  if (source.parentId != null) {
    await updateTask(source.id, { isCompleted: proxy.isCompleted });
    const siblings = await getSubtasksByParent(source.parentId);
    const completedCount = siblings.filter((s) => s.isCompleted).length;
    await updateTask(source.parentId, { subtasksCompleted: completedCount });

    if (siblings.length > 0 && completedCount === siblings.length) {
      await get().completeTask(source.parentId);
    } else {
      await get().uncompleteTask(source.parentId);
    }
  }

  // Case B: Proxy points directly to a period-scoped goal (Hybrid or Occurrence)
  if (source.parentId == null && source.scope !== 'daily') {
    // If it's a Hybrid goal occurrence, sync its subtasksCompleted count
    const subtasks = await getSubtasksByParent(source.id);
    if (subtasks.length > 0) {
      const completedCount = subtasks.filter((s) => s.isCompleted).length;
      await updateTask(source.id, { subtasksCompleted: completedCount });
      if (completedCount === subtasks.length) {
        await get().completeTask(source.id);
      } else {
        await get().uncompleteTask(source.id);
      }
    }
  }

  await ensureDailyDecompositionForDate(getAppToday());
  await get().loadTasks();
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

        await syncMilestoneFromProxy(get, updated);

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
}));

