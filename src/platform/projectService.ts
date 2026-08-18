/**
 * 项目/目录相关平台能力(ADR-003 薄适配层)
 */
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  children: DirEntry[] | null;
}

/** 弹出文件夹选择框;取消返回 null */
export async function pickFolder(): Promise<string | null> {
  const path = await open({ directory: true, multiple: false });
  return typeof path === "string" ? path : null;
}

/** 读取目录树(目录优先排序,跳过隐藏文件与 node_modules 等) */
export async function readDirTree(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("read_dir_tree", { path, maxDepth: 8 });
}

/** 判断路径是否是可用文档打开的文件类型 */
export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}
