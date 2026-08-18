/**
 * 文档全文搜索(纯逻辑,可单测)。
 *
 * 子串匹配(大小写不敏感),最符合文档场景——工程师找的是精确术语/API 名,
 * fuzzy 反而会塞进无关结果。结果按文件分组,带行号 + 列范围用于高亮跳转。
 */

export interface SearchMatch {
  /** 1-based 行号 */
  line: number;
  /** 匹配在该行的起始列(0-based) */
  col: number;
  /** 匹配长度 */
  length: number;
  /** 该行原文(用于显示上下文) */
  text: string;
}

export interface FileSearchResult {
  file: string;
  matches: SearchMatch[];
}

/**
 * 在一组文件内容里搜索 query,返回按文件分组的匹配。
 * 空 query 返回空。
 * 单文件匹配数封顶 maxPerFile,避免超大文件刷屏。
 */
export function searchInFiles(
  contents: Map<string, string>,
  query: string,
  maxPerFile = 50,
): FileSearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const results: FileSearchResult[] = [];

  for (const [file, content] of contents) {
    const matches: SearchMatch[] = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length && matches.length < maxPerFile; i++) {
      const line = lines[i];
      const lc = line.toLowerCase();
      let from = 0;
      let idx = lc.indexOf(lower, from);
      while (idx >= 0 && matches.length < maxPerFile) {
        matches.push({
          line: i + 1,
          col: idx,
          length: q.length,
          text: line,
        });
        from = idx + q.length;
        idx = lc.indexOf(lower, from);
      }
    }
    if (matches.length > 0) {
      results.push({ file, matches });
    }
  }
  // 匹配数多的文件排前
  results.sort((a, b) => b.matches.length - a.matches.length);
  return results;
}

/** 截取匹配行的上下文片段(避免长行全显示),返回 {before, match, after} */
export function snippetAround(
  text: string,
  col: number,
  length: number,
  radius = 40,
): { before: string; match: string; after: string } {
  const start = Math.max(0, col - radius);
  const end = Math.min(text.length, col + length + radius);
  return {
    before: (start > 0 ? "…" : "") + text.slice(start, col),
    match: text.slice(col, col + length),
    after: text.slice(col + length, end) + (end < text.length ? "…" : ""),
  };
}
