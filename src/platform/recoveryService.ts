/**
 * 崩溃恢复草稿:存 app data 目录的会话快照。
 * 新文档/未保存修改时,编辑停顿后存快照;已存盘文件不存(磁盘已是真相)。
 * 启动时若有快照 → 提示用户恢复。
 */
import { invoke } from "@tauri-apps/api/core";

export async function loadRecoveryDraft(): Promise<string | null> {
  if (!("__TAURI_INTERNALS__" in window)) return null;
  return invoke<string | null>("recovery_load");
}

export async function saveRecoveryDraft(content: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("recovery_save", { content });
}

export async function clearRecoveryDraft(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("recovery_clear");
}
