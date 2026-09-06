import { create } from 'zustand';
import {
    deleteEvent,
    getEventsByDate,
    insertEvent,
    updateEvent,
} from '../db/queries';
import { events as eventsTable } from '../db/schema';
import { getLocalDateString } from '../utils/date';

export type EventRow = typeof eventsTable.$inferSelect;

export interface NewEventPayload {
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
  selectedDate: getLocalDateString(),

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
    get().loadEvents(date);
  },

  loadEvents: async (date?: string) => {
    const targetDate = date ?? get().selectedDate;
    set({ isLoading: true });
    try {
      const data = await getEventsByDate(targetDate);
      set({ events: data });
    } catch (error) {
      console.error('Failed to load events:', error);
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
      console.error('Failed to add event:', error);
      return null;
    }
  },

  updateEvent: async (id: number, data) => {
    try {
      await updateEvent(id, data);
      await get().loadEvents();
    } catch (error) {
      console.error(`Failed to update event ${id}:`, error);
    }
  },

  removeEvent: async (id: number) => {
    try {
      await deleteEvent(id);
      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
      }));
    } catch (error) {
      console.error(`Failed to remove event ${id}:`, error);
    }
  },
}));