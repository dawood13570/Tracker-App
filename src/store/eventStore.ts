import { deleteEvent, getEventsByDate, insertEvent, updateEvent } from "@/db/queries";
import { format } from "date-fns";
import { create } from "zustand";

export type EventRow = Awaited<ReturnType<typeof getEventsByDate>>[number];

type EventStore = {
    events: EventRow[];
    isLoading: boolean;
    selectedDate: string;
    loadEvents: (date?: string) => Promise<void>;
    addEvent: (data: {title: string; startTime: string; endTime?: string | null; location?: string | null }) => Promise<void>;
    updateEvent: (id: number, data: Partial<{ title: string; startTime: string; endTime: string | null; location: string | null }>) => Promise<void>;
    removeEvent: (id: number) => Promise<void>;
};

export const useEventStore = create<EventStore>((set, get) => ({
    events: [],
    isLoading: false,
    selectedDate: format(new Date(), 'yyyy-MM-dd'),

    loadEvents: async (date) => {
        const targetDate = date ?? get().selectedDate;
        set({ isLoading: true, selectedDate: targetDate });
        const events = await getEventsByDate(targetDate);
        set({ events, isLoading: false})
    },

    addEvent: async (data) => {
        await insertEvent(data);
        await get().loadEvents();
    },

    updateEvent: async (id, data) => {
        await updateEvent(id, data);
        await get().loadEvents();
    },

    removeEvent: async (id) => {
        await deleteEvent(id);
        await get().loadEvents();
    },
}));