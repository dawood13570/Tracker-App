//tagstore.ts
import { createTag, deleteTag, getAllTags, getMostUsedTags, renameTag } from "@/db/queries";
import { create } from "zustand";

export type Tag = Awaited<ReturnType<typeof getAllTags>>[number];

type TagStore = {
  tags: Tag[];
  mostUsedTags: Tag[];
  tagVersion: number;
  loadTags: () => Promise<void>;
  loadMostUsedTags: () => Promise<void>;
  addTag: (data: { name: string; color?: string | null }) => Promise<Tag>;
  renameTag: (id: number, data: { name?: string; color?: string | null }) => Promise<void>;
  removeTag: (id: number) => Promise<void>;
};

export const useTagStore = create<TagStore>((set, get) => ({
  tags: [],
  mostUsedTags: [],
  tagVersion: 0,

  loadTags: async () => {
    const tags = await getAllTags();
    set({ tags });
  },

  loadMostUsedTags: async () => {
    const mostUsedTags = await getMostUsedTags();
    set({ mostUsedTags });
  },

  addTag: async (data) => {
    const newTag = await createTag(data);
    await get().loadTags();
    return newTag;
  },

  renameTag: async (id, data) => {
    await renameTag(id, data);
    await get().loadTags();
  },

  removeTag: async (id) => {
    await deleteTag(id);
    await get().loadTags();
  },
}));