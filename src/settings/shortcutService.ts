/**
 * 快捷键服务:组合键字符串("Cmd+Shift+O")与事件匹配、持久化。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ShortcutAction =
  | "openFile"
  | "saveFile"
  | "toggleExplorer"
  | "toggleInspector"
  | "commandPalette"
  | "toggleSourceMode"
  | "openSettings"
  | "toggleAiChat"
  | "search"
  | "toggleLog"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset";

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  openFile: "打开文件",
  saveFile: "保存",
  toggleExplorer: "切换左侧面板",
  toggleInspector: "切换 Inspector",
  commandPalette: "命令面板",
  toggleSourceMode: "切换视觉/源码模式",
  openSettings: "打开设置",
  toggleAiChat: "AI 对话",
  search: "全项目搜索",
  toggleLog: "日志面板(开发模式)",
  zoomIn: "界面放大(演示)",
  zoomOut: "界面缩小",
  zoomReset: "界面缩放重置",
};

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  openFile: "Cmd+O",
  saveFile: "Cmd+S",
  toggleExplorer: "Cmd+B",
  toggleInspector: "Cmd+J",
  commandPalette: "Cmd+K",
  toggleSourceMode: "Cmd+/",
  openSettings: "Cmd+,",
  toggleAiChat: "Cmd+L",
  search: "Cmd+Shift+F",
  toggleLog: "Cmd+D",
  zoomIn: "Cmd+Plus",
  zoomOut: "Cmd+Minus",
  zoomReset: "Cmd+0",
};

interface ShortcutState {
  shortcuts: Record<ShortcutAction, string>;
  setShortcut: (action: ShortcutAction, combo: string) => void;
  resetShortcuts: () => void;
}

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set) => ({
      shortcuts: { ...DEFAULT_SHORTCUTS },
      setShortcut: (action, combo) =>
        set((s) => ({ shortcuts: { ...s.shortcuts, [action]: combo } })),
      resetShortcuts: () => set({ shortcuts: { ...DEFAULT_SHORTCUTS } }),
    }),
    { name: "velora-shortcuts" },
  ),
);

/** 把键盘事件转成组合键字符串;纯修饰键返回 null */
export function comboFromEvent(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const key = e.key;
  if (["Meta", "Control", "Alt", "Shift"].includes(key)) return null;
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("Cmd");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join("+");
}

/** 匹配事件到动作;无匹配返回 null */
export function matchShortcut(e: KeyboardEvent): ShortcutAction | null {
  let combo = comboFromEvent(e);
  if (!combo || !combo.includes("+")) return null;
  // 缩放键兼容:物理键 = 在 shift 下是 +,统一归一化
  if (combo === "Cmd+Shift+=" || combo === "Cmd+=") combo = "Cmd+Plus";
  if (combo === "Cmd+-" || combo === "Cmd+_") combo = "Cmd+Minus";
  const shortcuts = useShortcutStore.getState().shortcuts;
  for (const [action, combo2] of Object.entries(shortcuts)) {
    if (combo2 === combo) return action as ShortcutAction;
  }
  return null;
}
