/**
 * 日志服务:前端错误/关键事件写 app data 日志文件 + console 双写。
 * 开发模式面板读取展示。
 */
import { invoke } from "@tauri-apps/api/core";

type Level = "error" | "warn" | "info";

function toConsole(level: Level, msg: string) {
  if (level === "error") console.error("[velora]", msg);
  else if (level === "warn") console.warn("[velora]", msg);
  else console.log("[velora]", msg);
}

export async function log(level: Level, message: string): Promise<void> {
  toConsole(level, message);
  if (!("__TAURI_INTERNALS__" in window)) return;
  try {
    await invoke("log_write", { level, message });
  } catch {
    // 日志失败不能再抛,静默
  }
}

export async function logError(error: unknown, context?: string): Promise<void> {
  const msg = context
    ? `${context}: ${error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error)}`
    : error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error);
  await log("error", msg);
}

export async function readLog(tailLines = 200): Promise<string> {
  if (!("__TAURI_INTERNALS__" in window)) return "";
  return invoke<string>("log_read", { tailLines });
}

export async function clearLog(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("log_clear");
}

export async function openLogFile(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const path = await invoke<string>("log_file_path");
  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
}

/** 安装全局错误捕获:未处理异常/rejection 自动写日志 */
export function installGlobalErrorCapture(): void {
  window.addEventListener("error", (e) => {
    const msg = e.error?.stack ?? e.message ?? String(e);
    void log("error", `未捕获错误: ${msg}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error
      ? `${e.reason.message}\n${e.reason.stack ?? ""}`
      : String(e.reason);
    void log("error", `未处理的 Promise 拒绝: ${reason}`);
  });
}
