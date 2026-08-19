/**
 * 最近文件(persist):环形列表,最多 12 条;含启动恢复目标。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_RECENT = 12;

interface RecentState {
  /** 最近打开的文件路径,最新在前 */
  recentFiles: string[];
  /** 上次关闭时打开的文档(启动恢复用) */
  lastFile: string | null;
  /** 启动时是否自动打开上次文档(设置里可关) */
  restoreOnLaunch: boolean;

  addRecent: (path: string) => void;
  removeRecent: (path: string) => void;
  setLastFile: (path: string | null) => void;
  setRestoreOnLaunch: (v: boolean) => void;
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      recentFiles: [],
      lastFile: null,
      restoreOnLaunch: true,

      addRecent: (path) =>
        set((s) => ({
          recentFiles: [path, ...s.recentFiles.filter((p) => p !== path)].slice(0, MAX_RECENT),
          lastFile: path,
        })),

      removeRecent: (path) =>
        set((s) => ({ recentFiles: s.recentFiles.filter((p) => p !== path) })),

      setLastFile: (lastFile) => set({ lastFile }),

      setRestoreOnLaunch: (restoreOnLaunch) => set({ restoreOnLaunch }),
    }),
    { name: "velora-recent" },
  ),
);
