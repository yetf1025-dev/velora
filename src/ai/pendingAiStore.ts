/**
 * 待应用的 AI 修改(D2 风格的会话内预览状态)。
 * AI 生成新节点属性后不直接落库,先放这里由 Diff 面板 Accept/Reject。
 * ADR-004:所有 AI 修改可预览、可撤销。
 */
import { create } from "zustand";

export interface PendingAiEdit {
  id: number;
  /** 修改的目标节点位置 */
  pos: number;
  /** 节点类型名(用于标题) */
  kind: string;
  /** 属性名(如 source / theme) */
  attr: string;
  /** 原值 */
  before: string;
  /** AI 生成的新值 */
  after: string;
  /** 应用:把 after 写回节点属性 */
  apply: () => void;
}

interface PendingState {
  current: PendingAiEdit | null;
  /** id 由 store 自动分配,调用方传其余字段 */
  set: (edit: Omit<PendingAiEdit, "id">) => void;
  clear: () => void;
}

let seq = 0;

export const usePendingAiStore = create<PendingState>((set) => ({
  current: null,
  set: (edit) => set({ current: { ...edit, id: ++seq } }),
  clear: () => set({ current: null }),
}));
