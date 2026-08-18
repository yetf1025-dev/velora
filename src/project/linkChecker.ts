/**
 * Broken Link 检查:扫描项目文档的链接/图片引用,标记目标不存在的。
 *
 * 纯逻辑(可单测):输入文件树 + 各文件内容,输出问题清单。
 * UI 层只负责读文件 + 跳转。
 */
import type { FileNode } from "../state/appStore";

export interface LinkIssue {
  /** 源文件绝对路径 */
  from: string;
  /** 引用的目标路径(原文,可能是相对/锚点/外部) */
  target: string;
  /** 引用类型 */
  kind: "link" | "image";
  /** 源文件中的行号(1-based) */
  line: number;
  /** 问题类型 */
  issue: "broken" | "missing-image";
}

const LINK_RE = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** 从 markdown 内容提取所有引用(链接/图片),带行号 */
export function extractRefs(
  content: string,
): Array<{ target: string; kind: "link" | "image"; line: number }> {
  const refs: Array<{ target: string; kind: "link" | "image"; line: number }> = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let m: RegExpExecArray | null;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(lines[i])) !== null) {
      const whole = m[0];
      const target = m[2];
      // 跳过外部 URL / 锚点 / 邮件
      if (/^(https?:|mailto:|tel:|#)/i.test(target)) continue;
      const kind = whole.startsWith("!") ? "image" : "link";
      refs.push({ target, kind, line: i + 1 });
    }
  }
  return refs;
}

/** 规范化相对路径:基于 fromFile 解析 target,返回绝对路径 */
export function resolveRef(fromFile: string, target: string): string {
  // 去掉锚点 #section 和查询 ?query
  const clean = target.split("#")[0].split("?")[0];
  if (!clean) return fromFile;
  if (clean.startsWith("/")) return clean;
  const baseDir = fromFile.slice(0, fromFile.lastIndexOf("/"));
  const parts = (baseDir + "/" + clean).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return "/" + out.join("/");
}

/** 判断路径是否存在于文件树 */
export function existsInTree(root: string, absPath: string, tree: FileNode[]): boolean {
  const rel = absPath.startsWith(root) ? absPath.slice(root.length) : absPath;
  const segs = rel.split("/").filter((s) => s.length > 0);
  let nodes: FileNode[] = tree;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const found = nodes.find((n) => n.name === seg);
    if (!found) return false;
    if (i === segs.length - 1) return true;
    nodes = found.children ?? [];
  }
  return false;
}

/**
 * 扫描整个项目,返回所有失效链接。
 * @param root 项目根绝对路径
 * @param tree 文件树
 * @param contents 路径 → 内容(已读)
 */
export function scanBrokenLinks(
  root: string,
  tree: FileNode[],
  contents: Map<string, string>,
): LinkIssue[] {
  const issues: LinkIssue[] = [];
  for (const [from, content] of contents) {
    if (!from.endsWith(".md") && !from.endsWith(".markdown")) continue;
    const refs = extractRefs(content);
    for (const ref of refs) {
      const abs = resolveRef(from, ref.target);
      if (!existsInTree(root, abs, tree)) {
        issues.push({
          from,
          target: ref.target,
          kind: ref.kind,
          line: ref.line,
          issue: ref.kind === "image" ? "missing-image" : "broken",
        });
      }
    }
  }
  return issues;
}

/** 收集文件树里所有 .md 文件路径 */
export function collectMarkdownFiles(tree: FileNode[]): string[] {
  const out: string[] = [];
  const walk = (nodes: FileNode[]) => {
    for (const n of nodes) {
      if (n.isDir) walk(n.children ?? []);
      else if (/\.(md|markdown)$/.test(n.name)) out.push(n.path);
    }
  };
  walk(tree);
  return out;
}
