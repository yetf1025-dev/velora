/**
 * 平台薄适配层(ADR-003):前端不直接感知 Tauri 命令细节。
 * 未来若出 Web 版,只需替换本文件实现。
 */
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

const MD_FILTERS = [{ name: "Markdown", extensions: ["md", "markdown"] }];

/** 弹出打开对话框并读取文件内容;用户取消时返回 null */
export async function openMarkdownFile(): Promise<{
  path: string;
  content: string;
} | null> {
  const path = await open({ filters: MD_FILTERS, multiple: false });
  if (!path || typeof path !== "string") return null;
  const content = await invoke<string>("read_file", { path });
  return { path, content };
}

/** 保存到已关联路径;无路径时弹出另存对话框。返回最终保存路径(取消返回 null) */
export async function saveMarkdownFile(
  currentPath: string | null,
  content: string,
): Promise<string | null> {
  let path = currentPath;
  if (!path) {
    const picked = await save({ filters: MD_FILTERS, defaultPath: "untitled.md" });
    if (!picked) return null;
    path = picked;
  }
  await invoke("write_file", { path, content });
  return path;
}

/** 读取任意文本文件(SVG 等资源用) */
export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

/** 写入任意文本文件 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  await invoke("write_file", { path, content });
}

/** 导出任意文本文件(如 SVG / HTML),弹另存对话框 */
export async function exportTextFile(
  defaultName: string,
  content: string,
): Promise<string | null> {
  const path = await save({ defaultPath: defaultName });
  if (!path) return null;
  await invoke("write_file", { path, content });
  return path;
}
