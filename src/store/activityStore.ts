import { create } from 'zustand';
import {
    ActivityLogRow,
    ActivityRow,
    deleteActivity,
    getActivityLogs,
    getAllActivities,
    getLastActivityLog,
    insertActivity,
    logActivity,
} from '../db/queries';
import { getLocalDateString } from '../utils/date';

export type { ActivityLogRow, ActivityRow };

export interface ActivityWithLastLog extends ActivityRow {
  lastLog: ActivityLogRow | null;
}

interface ActivityState {
  activities: ActivityWithLastLog[];
  isLoading: boolean;
  loadActivities: () => Promise<void>;
  addActivity: (title: string) => Promise<ActivityRow | null>;
  removeActivity: (id: number) => Promise<void>;
  quickLog: (activityId: number, note?: string | null, date?: string) => Promise<void>;
  getHistory: (activityId: number) => Promise<ActivityLogRow[]>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  isLoading: false,

  loadActivities: async () => {
    set({ isLoading: true });
    try {
      const rows = await getAllActivities();
      const withLogs = await Promise.all(
        rows.map(async (act) => {
          const lastLog = await getLastActivityLog(act.id);
          return { ...act, lastLog };
        })
      );
      set({ activities: withLogs });
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addActivity: async (title: string) => {
    try {
      const inserted = await insertActivity({ title });
      if (inserted) {
        set((state) => ({
          activities: [...state.activities, { ...inserted, lastLog: null }],
        }));
        return inserted;
      }
      return null;
    } catch (error) {
      console.error('Failed to insert activity:', error);
      return null;
    }
  },

  removeActivity: async (id: number) => {
    try {
      await deleteActivity(id);
      set((state) => ({
        activities: state.activities.filter((a) => a.id !== id),
      }));
    } catch (error) {
      console.error('Failed to remove activity:', error);
    }
  },

  quickLog: async (activityId: number, note?: string | null, date?: string) => {
    try {
      const logDate = date ?? getLocalDateString(new Date());
      const newLog = await logActivity({ activityId, date: logDate, note });
      if (newLog) {
        set((state) => ({
          activities: state.activities.map((act) =>
            act.id === activityId ? { ...act, lastLog: newLog } : act
          ),
        }));
      }
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  },

  getHistory: async (activityId: number) => {
    return getActivityLogs(activityId);
  },
}));