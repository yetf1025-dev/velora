/**
 * TocNode —— [TOC] 标签 → 自动目录。
 *
 * 独占一行的 `[TOC]` 被解析为 toc 节点,渲染时从文档标题实时生成目录。
 * 序列化写回 `[TOC]`,源码保持极简。
 *
 * 实现注意:不能用 markdownTokenName="paragraph" 拦截段落——
 * 序列化查找先查 token 注册表,会导致所有普通段落都被渲染成 [TOC]。
 * 必须用自定义 block tokenizer 产出独立的 toc token。
 */
import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownParseResult,
  MarkdownRendererHelpers,
  MarkdownToken,
  RenderContext,
} from "@tiptap/core";
import { Node } from "@tiptap/core";

const TOC_LINE_RE = /^\[TOC\][ \t]*(\n|$)/i;

export const TocNode = Node.create({
  name: "toc",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toc"]' }];
  },

  renderHTML() {
    return ["div", { "data-type": "toc" }];
  },

  markdownTokenName: "toc",

  parseMarkdown(
    _token: MarkdownToken,
    _helpers: MarkdownParseHelpers,
  ): MarkdownParseResult {
    return { type: "toc" };
  },

  renderMarkdown(
    _node: JSONContent,
    _helpers: MarkdownRendererHelpers,
    _ctx: RenderContext,
  ): string {
    return "[TOC]";
  },

  // 自定义 block tokenizer:独占一行的 [TOC],先于 paragraph tokenizer 执行
  markdownTokenizer: {
    name: "toc",
    level: "block",
    start(src: string): number {
      const match = src.match(/^\[TOC\][ \t]*$/im);
      return match?.index ?? -1;
    },
    tokenize(src: string) {
      const match = src.match(TOC_LINE_RE);
      if (!match) return undefined;
      return { type: "toc", raw: match[0] };
    },
  },
});
