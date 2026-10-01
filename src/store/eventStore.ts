import { reportError } from '../utils/errors';
import { create } from 'zustand';
import {
    deleteEvent,
    getEventsByDate,
    insertEvent,
    updateEvent,
} from '../db/queries';
import { events as eventsTable } from '../db/schema';
import { getAppToday } from '../utils/date';

export type EventRow = typeof eventsTable.$inferSelect;

export interface NewEventPayload {
  pursuitId?: number | null;
  title: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
}

interface EventState {
  events: EventRow[];
  isLoading: boolean;
  selectedDate: string;

  setSelectedDate: (date: string) => void;
  loadEvents: (date?: string) => Promise<void>;
  addEvent: (data: NewEventPayload) => Promise<EventRow | null>;
  updateEvent: (
    id: number,
    data: Partial<{
      pursuitId: number | null;
      title: string;
      startTime: string;
      endTime: string | null;
      location: string | null;
    }>
  ) => Promise<void>;
  removeEvent: (id: number) => Promise<void>;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  isLoading: false,
  selectedDate: getAppToday(),

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
    get().loadEvents(date);
  },

  loadEvents: async (date?: string) => {
    const targetDate = date ?? getAppToday();
        set({ selectedDate: targetDate });
    set({ isLoading: true });
    try {
      const data = await getEventsByDate(targetDate);
      set({ events: data });
    } catch (error) {
      reportError(error);
    } finally {
      set({ isLoading: false });
    }
  },

  addEvent: async (data: NewEventPayload) => {
    try {
      const inserted = await insertEvent(data);
      if (inserted) {
        await get().loadEvents();
        return inserted;
      }
      return null;
    } catch (error) {
      reportError(error);
      return null;
    }
  },

  updateEvent: async (id: number, data) => {
    try {
      await updateEvent(id, data);
      await get().loadEvents();
    } catch (error) {
      reportError(error);
    }
  },

  removeEvent: async (id: number) => {
    try {
      await deleteEvent(id);
      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
      }));
    } catch (error) {
      reportError(error);
    }
  },
}));