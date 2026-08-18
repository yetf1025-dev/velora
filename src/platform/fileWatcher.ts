/**
 * 项目文件监听:Rust notify → Tauri event → 前端去抖刷新。
 *
 * A 方案(Typora 式):当前文档被外部修改 → 立即重载,以磁盘为准。
 * 自己写盘的回声通过 selfWriting 标记挂起,避免死循环。
 */
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { refreshFileTree, reloadCurrentFile } from "../editor/editorController";
import { useAppStore } from "../state/appStore";
import { useGitStore } from "../state/gitStore";

let unlisten: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPaths: string[] = [];

/** 自己写盘期间挂起重载,避免保存回声触发"外部修改"死循环 */
let selfWriting = false;
let selfWritingTimer: ReturnType<typeof setTimeout> | null = null;

/** Velora 自己即将写盘:挂起重载(给一个回声吸收窗口) */
export function notifySelfWriteStart(): void {
  selfWriting = true;
  if (selfWritingTimer) clearTimeout(selfWritingTimer);
  // 回声窗口:notify 事件可能延迟到达,给 1.2s 吸收
  selfWritingTimer = setTimeout(() => {
    selfWriting = false;
  }, 1200);
}

export async function startWatching(root: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;

  if (!unlisten) {
    unlisten = await listen<string[]>("velora-fs-change", (event) => {
      pendingPaths.push(...event.payload);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, 500);
    });
  }
  await invoke("watch_dir", { path: root });
}

export async function stopWatching(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("unwatch_dir");
}

function flush(): void {
  const paths = pendingPaths;
  pendingPaths = [];

  const { currentFilePath, setExternalModified } = useAppStore.getState();

  // 自己刚写盘的回声:吞掉,不当外部修改处理
  if (selfWriting) {
    void refreshFileTree();
    void useGitStore.getState().refresh();
    return;
  }

  // 当前文档被外部修改 → 立即重载(以磁盘为准,Typora 式)
  if (currentFilePath && paths.some((p) => p === currentFilePath)) {
    setExternalModified(false);
    void reloadCurrentFile();
  }

  void refreshFileTree();
  void useGitStore.getState().refresh();
}
