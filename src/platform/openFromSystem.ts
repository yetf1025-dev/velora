/**
 * 系统级「打开文件」事件(ADR-003 薄适配层)。
 *
 * 双击 .md / Finder「打开方式」→ Rust 侧 RunEvent::Opened(macOS)或
 * argv(Windows/Linux)→ 路由到聚焦窗口(或主窗口)emit
 * "system-open-path"。事件是定向单发,前端直接处理即可。
 */
import { listen } from "@tauri-apps/api/event";

/** 监听系统打开请求;返回清理函数。 */
export function onSystemOpenPath(handler: (paths: string[]) => void): () => void {
  if (!("__TAURI_INTERNALS__" in window)) return () => {};
  const unlistenP = listen<string>("system-open-path", (event) => {
    handler(event.payload.split("\u{1f}"));
  });
  return () => {
    void unlistenP.then((unlisten) => unlisten());
  };
}
