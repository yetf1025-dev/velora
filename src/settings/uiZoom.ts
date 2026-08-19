/**
 * 界面缩放(演示模式):WebView 级整体缩放,所有 UI 等比变大。
 * ⌘+ / ⌘− / ⌘0(重置);持久化记忆。
 */
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MIN = 0.8;
const MAX = 2.0;
const STEP = 0.1;

interface UiZoomState {
  /** 缩放系数,1 = 原始 */
  zoom: number;
  zoomIn: () => Promise<void>;
  zoomOut: () => Promise<void>;
  resetZoom: () => Promise<void>;
}

export const useUiZoomStore = create<UiZoomState>()(
  persist(
    (set, get) => ({
      zoom: 1,

      zoomIn: async () => {
        const next = Math.min(MAX, Math.round((get().zoom + STEP) * 10) / 10);
        await applyZoom(next);
        set({ zoom: next });
      },

      zoomOut: async () => {
        const next = Math.max(MIN, Math.round((get().zoom - STEP) * 10) / 10);
        await applyZoom(next);
        set({ zoom: next });
      },

      resetZoom: async () => {
        await applyZoom(1);
        set({ zoom: 1 });
      },
    }),
    { name: "velora-ui-zoom" },
  ),
);

async function applyZoom(zoom: number): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  try {
    await getCurrentWebview().setZoom(zoom);
  } catch {
    // 权限缺失或平台不支持时静默(状态仍更新,下次可用)
  }
}

/** 应用启动时恢复上次缩放 */
export async function restoreZoom(): Promise<void> {
  const { zoom } = useUiZoomStore.getState();
  if (zoom !== 1) await applyZoom(zoom);
}

/**
 * ⌘/Ctrl + 滚轮缩放(浏览器惯例;Tauri 内置 hotkeys 只管键盘 -/=)。
 * 捕获阶段 + passive:false 拦截默认滚动;平滑步进(滚轮一格 ≈ 3%)。
 */
export function installWheelZoom(): void {
  window.addEventListener(
    "wheel",
    (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const { zoom } = useUiZoomStore.getState();
      // 平滑小步:每格 3%(比键盘 10% 更细,符合滚轮手感)
      const target = Math.min(2, Math.max(0.8, zoom + (e.deltaY < 0 ? 0.03 : -0.03)));
      const rounded = Math.round(target * 100) / 100;
      useUiZoomStore.setState({ zoom: rounded });
      void applyZoom(rounded);
    },
    { passive: false, capture: true },
  );
}
