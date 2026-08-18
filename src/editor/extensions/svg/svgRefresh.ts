/**
 * SVG 刷新/画布请求信号:
 * - bump:文件来源 SVG 被写回磁盘后,通知 SvgView 重新读取
 * - requestCanvas:右键菜单请求打开画布编辑器(SvgInspector 响应)
 */
import { create } from "zustand";

interface SvgRefreshState {
  version: number;
  canvasRequest: number;
  bump: () => void;
  requestCanvas: () => void;
}

export const useSvgRefreshStore = create<SvgRefreshState>((set) => ({
  version: 0,
  canvasRequest: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
  requestCanvas: () => set((s) => ({ canvasRequest: s.canvasRequest + 1 })),
}));
