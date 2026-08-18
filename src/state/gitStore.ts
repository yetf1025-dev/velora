/**
 * Git 平台能力 + 状态(ADR-003:Rust 侧只执行 git CLI,业务状态在这里)
 */
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { useAppStore } from "./appStore";

export interface GitChange {
  status: string;
  path: string;
}

export interface GitStatus {
  isRepo: boolean;
  branch: string;
  changes: GitChange[];
}

interface GitState extends GitStatus {
  refresh: () => Promise<void>;
  commitAll: (message: string) => Promise<string>;
}

export const useGitStore = create<GitState>((set) => ({
  isRepo: false,
  branch: "",
  changes: [],

  refresh: async () => {
    const root = useAppStore.getState().projectRoot;
    if (!root) {
      set({ isRepo: false, branch: "", changes: [] });
      return;
    }
    try {
      const status = await invoke<GitStatus>("git_status", { root });
      set(status);
    } catch {
      set({ isRepo: false, branch: "", changes: [] });
    }
  },

  commitAll: async (message: string) => {
    const root = useAppStore.getState().projectRoot;
    if (!root) throw new Error("未打开项目");
    const out = await invoke<string>("git_commit_all", { root, message });
    const status = await invoke<GitStatus>("git_status", { root });
    set(status);
    return out;
  },
}));

export async function gitDiff(path: string): Promise<string> {
  const root = useAppStore.getState().projectRoot;
  if (!root) return "";
  return invoke<string>("git_diff", { root, path });
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

/** 文件提交历史(限定 path 则是该文件历史,否则全仓库) */
export async function gitLog(path?: string): Promise<GitCommit[]> {
  const root = useAppStore.getState().projectRoot;
  if (!root) return [];
  return invoke<GitCommit[]>("git_log", { root, path: path ?? null });
}

/** 某次 commit 对某文件的 diff */
export async function gitShow(hash: string, path: string): Promise<string> {
  const root = useAppStore.getState().projectRoot;
  if (!root) return "";
  return invoke<string>("git_show", { root, hash, path });
}
