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
      return /^---[ \t]*\r?\n/.test(src) ? 0 : -1;
    },
    tokenize(src: string) {
      // 严格 YAML frontmatter:
      //   ---\n  开头(容忍行尾空白与 CRLF)
      //   紧跟至少一行 key: value 形式(YAML,不是 markdown 正文)
      //   独占一行 --- 闭合;body 内不允许空行(空行后多半已是正文)
      // 逐行扫描,不用单个回溯式正则:回溯正则在闭合 --- 超出量词上限时
      // 必然失配,(?:.*\S.*\n){0,30} 的跨行拆分组合是指数级,30 行以上的
      // frontmatter 会把主线程卡死(design.md 事故,阈值实测 30 行)。
      const open = src.match(/^---[ \t]*\r?\n/);
      if (!open) return undefined;
      let pos = open[0].length;
      // 第一行 body 必须是 key: 形式
      const firstNl = src.indexOf("\n", pos);
      const firstLine = (firstNl === -1 ? src.slice(pos) : src.slice(pos, firstNl)).replace(/\r$/, "");
      if (!/^[a-zA-Z_][\w\-]*\s*:/.test(firstLine)) return undefined;
      // 扫描闭合行;行数上限只是防吞整篇的保险,不再是回溯炸弹
      const MAX_BODY_LINES = 100;
      for (let i = 0; i <= MAX_BODY_LINES; i++) {
        const nl = src.indexOf("\n", pos);
        const line = (nl === -1 ? src.slice(pos) : src.slice(pos, nl)).trimEnd();
        if (line === "---") {
          const end = nl === -1 ? src.length : nl + 1;
          return { type: "frontmatter", raw: src.slice(0, end) };
        }
        if (line === "") return undefined; // 空行 = frontmatter 结束还没等到闭合
        if (i === MAX_BODY_LINES) return undefined; // body 超上限仍未闭合
        if (nl === -1) return undefined; // 到文末都没有闭合
        pos = nl + 1;
      }
      return undefined;
    },
  },
});
