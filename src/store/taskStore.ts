import { create } from 'zustand';
import { changeTaskCompletion, deleteTaskTree } from '../db/lifecycle';
import { ensureDailyDecompositionForDate, getTaskByDate, insertTask, updateTask, type NewTask, type UpdateTask } from '../db/queries';
import { tasks as tasksTable } from '../db/schema';
import { getAppToday } from '../utils/date';
import { reportError } from '../utils/errors';
export type Task = typeof tasksTable.$inferSelect;
export type { NewTask };
interface TaskState {
  tasks: Task[]; isLoading: boolean; selectedDate: string;
  setSelectedDate: (date: string) => void;
  loadTasks: (date?: string) => Promise<void>;
  addTask: (task: NewTask) => Promise<Task | null>;
  updateTask: (id: number, data: UpdateTask) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  completeTask: (id: number) => Promise<void>;
  uncompleteTask: (id: number) => Promise<void>;
  removeTask: (id: number) => Promise<void>;
}
let request = 0;
export const useTaskStore = create<TaskState>((set, get) => {
  const complete = async (id: number, value?: boolean) => {
    try {
      changeTaskCompletion(id, value);
      await ensureDailyDecompositionForDate(getAppToday());
      await get().loadTasks();
    } catch (error) { reportError(error); }
  };
  return {
    tasks: [], isLoading: false, selectedDate: getAppToday(),
    setSelectedDate: date => { set({ selectedDate: date }); void get().loadTasks(date); },
    loadTasks: async (date = getAppToday()) => {
      const version = ++request;
      set({ isLoading: true, selectedDate: date });
      try { const tasks = await getTaskByDate(date); if (version === request) set({ tasks }); }
      catch (error) { reportError(error); }
      finally { if (version === request) set({ isLoading: false }); }
    },
    addTask: async task => { const inserted = await insertTask(task); await get().loadTasks(); return inserted; },
    updateTask: async (id, data) => { await updateTask(id, data); await get().loadTasks(); },
    toggleTask: id => complete(id), completeTask: id => complete(id, true), uncompleteTask: id => complete(id, false),
    removeTask: async id => { deleteTaskTree(id); await get().loadTasks(); },
  };
});
