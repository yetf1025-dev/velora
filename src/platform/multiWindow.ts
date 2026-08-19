/**
 * 多窗口:新建编辑器窗口(Tauri WebviewWindow)。
 * 新窗口经 URL hash 传文件路径;App 启动时读取 hash 打开指定文件
 * (有 hash 时跳过"恢复上次文档",避免所有窗口都开同一个)。
 */
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

let windowSeq = 0;

/**
 * 新建窗口。path 传入则该窗口直接打开此文件;否则空文档。
 * 窗口标题跟随文件由 TitleBar 显示,这里给个默认名。
 */
export async function newEditorWindow(path?: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  windowSeq += 1;
  const label = `editor-${Date.now()}-${windowSeq}`;
  const hash = path ? `#open=${encodeURIComponent(path)}` : "#new";
  await new WebviewWindow(label, {
    url: `/${hash}`,
    title: "Velora",
    width: 1200,
    height: 800,
  });
}

/** 启动时从 URL hash 读取要打开的文件(多窗口传参) */
export function pathFromHash(): string | null {
  const m = window.location.hash.match(/^#open=(.+)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}
