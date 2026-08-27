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
  /** 编辑器正文列宽上限(px);实际列宽还会受主区域实际宽度约束 */
  editorMaxWidth: number;
  setAutoSave: (v: boolean) => void;
  setAutoSaveDelay: (ms: number) => void;
  setEditorMaxWidth: (px: number) => void;
}

/** 编辑器宽度设置的合法区间与默认值(设置项持久化前后都要净化到此区间) */
export const EDITOR_WIDTH_MIN = 760;
export const EDITOR_WIDTH_MAX = 1440;
export const EDITOR_WIDTH_DEFAULT = 1080;

export function clampEditorWidth(px: number): number {
  if (!Number.isFinite(px)) return EDITOR_WIDTH_DEFAULT;
  return Math.min(EDITOR_WIDTH_MAX, Math.max(EDITOR_WIDTH_MIN, Math.round(px)));
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      autoSave: true,
      autoSaveDelay: 800,
      editorMaxWidth: EDITOR_WIDTH_DEFAULT,
      setAutoSave: (autoSave) => set({ autoSave }),
      setAutoSaveDelay: (autoSaveDelay) => set({ autoSaveDelay }),
      // 写入前 clamp:非法值不进 store
      setEditorMaxWidth: (px) => set({ editorMaxWidth: clampEditorWidth(px) }),
    }),
    {
      name: "velora-prefs",
      // 读出时 clamp:localStorage 被手改或未来字段语义变化时的防线
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedPrefs>;
        return {
          ...current,
          ...p,
          editorMaxWidth: clampEditorWidth(
            typeof p.editorMaxWidth === "number" ? p.editorMaxWidth : EDITOR_WIDTH_DEFAULT,
          ),
        };
      },
    },
  ),
);

type PersistedPrefs = Pick<PrefsState, "autoSave" | "autoSaveDelay" | "editorMaxWidth">;
