/**
 * FrontmatterNode —— 文档开头的 YAML frontmatter(Obsidian/Hugo/Jekyll 常见)。
 *
 * 形态:
 *   ---
 *   title: ...
 *   ---
 *
 * 作为 atom 块,原样保留 YAML 文本(不解析内容),保证 round-trip 不丢。
 * 仅在文档开头识别。
 */
import type {
  JSONContent,
  MarkdownParseResult,
  MarkdownToken,
} from "@tiptap/core";
import { Node } from "@tiptap/core";

export const FrontmatterNode = Node.create({
  name: "frontmatter",
  group: "block",
  atom: true,

  addAttributes() {
    return { source: { default: "" } };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="frontmatter"]' }];
  },

  renderHTML() {
    return ["div", { "data-type": "frontmatter" }];
  },

  markdownTokenName: "frontmatter",

  parseMarkdown(token: MarkdownToken): MarkdownParseResult {
    const raw = (token as unknown as { raw?: string }).raw ?? "";
    return { type: "frontmatter", attrs: { source: raw } };
  },

  renderMarkdown(node: JSONContent): string {
    return ((node.attrs?.source as string) ?? "").trim();
  },

  markdownTokenizer: {
    name: "frontmatter",
    level: "block",
    start(src: string): number {
      // 只在文档起始位置认领(避免把正文里的 --- --- 误判)
      return src.startsWith("---\n") ? 0 : -1;
    },
    tokenize(src: string) {
      // 严格 YAML frontmatter:
      //   ---\n  开头
      //   紧跟至少一行 key: value 形式(YAML,不是 markdown 正文)
      //   \n---  闭合
      // 中间不能跨过明显是 markdown 的结构(用非贪心 + 行数上限)
      const m = src.match(
        /^---[ \t]*\n([a-zA-Z_][\w\-]*\s*:.*\n(?:.*\S.*\n){0,30}?)---[ \t]*(\n|$)/,
      );
      if (!m) return undefined;
      return { type: "frontmatter", raw: m[0] };
    },
  },
});
