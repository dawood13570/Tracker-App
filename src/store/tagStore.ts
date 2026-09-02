import { createTag, deleteTag, getAllTags, renameTag } from "@/db/queries";
import { create } from "zustand";

export type Tag = Awaited<ReturnType<typeof getAllTags>>[number];

type TagStore = {
  tags: Tag[];
  loadTags: () => Promise<void>;
  addTag: (data: { name: string; color?: string | null }) => Promise<Tag>;
  renameTag: (id: number, data: { name?: string; color?: string | null }) => Promise<void>;
  removeTag: (id: number) => Promise<void>;
};

export const useTagStore = create<TagStore>((set, get) => ({
  tags: [],

  loadTags: async () => {
    const tags = await getAllTags();
    set({ tags });
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