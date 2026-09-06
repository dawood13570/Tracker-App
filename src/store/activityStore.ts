import { create } from 'zustand';
import {
  ActivityLogRow,
  ActivityLogWithDetails,
  ActivityRow,
  createActivityEntryWithTags,
  deleteActivityLog,
  getActivityLogsForDate,
  getActivityLogsForDateRange,
  getAllActivityMasters,
  searchActivityLogs as searchActivityLogsQuery,
} from '../db/queries';
import { getLocalDateString } from '../utils/date';

export type { ActivityLogRow, ActivityLogWithDetails, ActivityRow };

interface ActivityState {
  logsByDate: Record<string, ActivityLogWithDetails[]>;
  masters: ActivityRow[];
  isLoading: boolean;
  loadActivitiesForDate: (date: string) => Promise<void>;
  loadActivitiesForRange: (startDate: string, endDate: string) => Promise<ActivityLogWithDetails[]>;
  loadMasters: () => Promise<void>;
  addActivityEntry: (params: {
    title: string;
    note?: string | null;
    date?: string;
    masterTagIds?: number[];
    extraTagIds?: number[];
  }) => Promise<ActivityLogWithDetails | null>;
  removeActivityEntry: (logId: number, date: string) => Promise<void>;
  searchLogs: (params: { text?: string; tagIds?: number[] }) => Promise<ActivityLogWithDetails[]>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  logsByDate: {},
  masters: [],
  isLoading: false,

  loadActivitiesForDate: async (date: string) => {
    set({ isLoading: true });
    try {
      const rows = await getActivityLogsForDate(date);
      set((state) => ({ logsByDate: { ...state.logsByDate, [date]: rows } }));
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadActivitiesForRange: async (startDate: string, endDate: string) => {
    const rows = await getActivityLogsForDateRange(startDate, endDate);
    set((state) => {
      const next = { ...state.logsByDate };
      for (const row of rows) {
        next[row.date] = [...(next[row.date] ?? []).filter((r) => r.id !== row.id), row];
      }
      return { logsByDate: next };
    });
    return rows;
  },

  loadMasters: async () => {
    try {
      const rows = await getAllActivityMasters();
      set({ masters: rows });
    } catch (error) {
      console.error('Failed to load activity masters:', error);
    }
  },

  addActivityEntry: async (params) => {
    try {
      const logDate = params.date ?? getLocalDateString(new Date());
      const newLog = await createActivityEntryWithTags({ ...params, date: logDate });

      await Promise.all([
        get().loadActivitiesForDate(logDate),
        get().loadMasters(),
      ]);

      return newLog;
    } catch (error) {
      console.error('Failed to add activity entry:', error);
      return null;
    }
  },

  removeActivityEntry: async (logId: number, date: string) => {
    try {
      await deleteActivityLog(logId);
      set((state) => ({
        logsByDate: {
          ...state.logsByDate,
          [date]: (state.logsByDate[date] ?? []).filter((l) => l.id !== logId),
        },
      }));
    } catch (error) {
      console.error('Failed to remove activity entry:', error);
    }
  },

  searchLogs: async (params) => searchActivityLogsQuery(params),
}));