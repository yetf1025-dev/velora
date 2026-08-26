/**
 * 拖拽打开(平台适配,ADR-003 薄层)。
 * - Tauri 桌面:webview 原生 onDragDropEvent,drop 时拿到文件绝对路径
 * - 浏览器 dev:无此能力,静默降级为 noop
 * 业务决策(开哪个文件、未保存守卫)在调用方 editorController/App。
 */
import { getCurrentWebview } from "@tauri-apps/api/webview";

/** 监听文件拖入窗口;返回清理函数。
 * onDrop:松手放下时回调文件绝对路径列表;onHover:文件悬停进入/离开 */
export function onFileDrop(
  onDrop: (paths: string[]) => void,
  onHover?: (hovering: boolean) => void,
): () => void {
  if (!("__TAURI_INTERNALS__" in window)) return () => {};
  const unlistenP = getCurrentWebview().onDragDropEvent((event) => {
    const e = event.payload;
    if (e.type === "drop") {
      onHover?.(false);
      onDrop(e.paths);
    } else if (e.type === "enter" || e.type === "over") {
      onHover?.(true);
    } else if (e.type === "leave") {
      onHover?.(false);
    }
  });
  return () => {
    void unlistenP.then((unlisten) => unlisten());
  };
}

export interface DropDecision {
  /** 要打开的 Markdown 文件(取第一个);无可开文件时为 null */
  file: string | null;
  /** 拖入的 Markdown 文件数 */
  mdCount: number;
  /** 拖入文件总数 */
  total: number;
}

/** 从拖入的文件里挑要打开的 Markdown(纯函数,便于单测) */
export function pickDroppedMarkdown(paths: string[]): DropDecision {
  const md = paths.filter((p) => /\.(md|markdown)$/i.test(p));
  return { file: md[0] ?? null, mdCount: md.length, total: paths.length };
}
