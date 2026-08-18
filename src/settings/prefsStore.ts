/**
 * 通用偏好设置(持久化)
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrefsState {
  /** 自动保存(编辑停顿后落盘;仅对已关联路径的文档生效) */
  autoSave: boolean;
  /** 自动保存去抖间隔(ms) */
  autoSaveDelay: number;
  setAutoSave: (v: boolean) => void;
  setAutoSaveDelay: (ms: number) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      autoSave: true,
      autoSaveDelay: 800,
      setAutoSave: (autoSave) => set({ autoSave }),
      setAutoSaveDelay: (autoSaveDelay) => set({ autoSaveDelay }),
    }),
    { name: "velora-prefs" },
  ),
);
