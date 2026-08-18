/**
 * DetailsNode —— <details>/<summary> 折叠块。
 *
 * Markdown 形态:
 *   <details>
 *   <summary>折叠标题</summary>
 *
 *   内部是完整 markdown……
 *
 *   </details>
 *
 * summary 存为节点属性(MVP 纯文本),内部内容是正常的块级子节点,
 * 因此折叠块里可以放 Mermaid / SVG / 表格等任何节点。
 */
import { marked } from "marked";
import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownParseResult,
  MarkdownRendererHelpers,
  MarkdownToken,
  RenderContext,
} from "@tiptap/core";
import { Node } from "@tiptap/core";

export interface DetailsAttrs {
  summary: string;
  open: boolean;
}

const DETAILS_BLOCK_RE = /^<details(\s[^>]*)?>[\s\S]*?<\/details>[ \t]*(\n|$)/;
const SUMMARY_RE = /<summary[^>]*>([\s\S]*?)<\/summary>/i;

export const DetailsNode = Node.create({
  name: "details",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      summary: { default: "" },
      open: { default: true },
    };
  },

  parseHTML() {
    return [
      {
        tag: "details",
        getAttrs: (element) => ({
          open: (element as HTMLElement).hasAttribute("open"),
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return [
      "details",
      node.attrs.open ? { open: "" } : {},
      ["summary", {}, node.attrs.summary ?? ""],
      ["div", { "data-details-content": "" }, 0],
    ];
  },

  addCommands() {
    return {
      insertDetails:
        (summary = "折叠标题") =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { summary, open: true },
            content: [{ type: "paragraph" }],
          }),
    };
  },

  // ── Markdown 映射 ──────────────────────────────────────
  markdownTokenName: "details",

  parseMarkdown(
    token: MarkdownToken,
    helpers: MarkdownParseHelpers,
  ): MarkdownParseResult {
    const raw = (token as unknown as { raw?: string }).raw ?? "";

    const summaryMatch = raw.match(SUMMARY_RE);
    const summary = summaryMatch?.[1]?.trim() ?? "";

    // 去掉 <details> 外壳与 <summary> 部分,内部按 markdown 解析
    let inner = raw
      .replace(/^<details(\s[^>]*)?>/, "")
      .replace(/<\/details>\s*$/, "");
    if (summaryMatch) inner = inner.replace(SUMMARY_RE, "");

    const innerTokens = marked.lexer(inner.trim());
    const content = helpers.parseChildren(innerTokens as MarkdownToken[]);

    const open = /^<details\s[^>]*\bopen\b/.test(raw);

    return {
      type: "details",
      attrs: { summary, open } satisfies DetailsAttrs,
      content: content.length > 0 ? content : [{ type: "paragraph" }],
    };
  },

  renderMarkdown(
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    _ctx: RenderContext,
  ): string {
    const attrs = (node.attrs ?? {}) as Record<string, unknown>;
    const summary = (attrs.summary as string) ?? "";
    const open = attrs.open === false ? "" : " open";
    const children = helpers.renderChildren(node.content ?? [], "\n\n");
    return `<details${open}>\n<summary>${summary}</summary>\n\n${children}\n\n</details>`;
  },

  // 自定义 block tokenizer:捕获行首 <details>...</details>
  markdownTokenizer: {
    name: "details",
    level: "block",
    start(src: string): number {
      const match = src.match(/^<details[\s>]/m);
      return match?.index ?? -1;
    },
    tokenize(src: string) {
      const match = src.match(DETAILS_BLOCK_RE);
      if (!match) return undefined;
      return { type: "details", raw: match[0] };
    },
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    details: {
      insertDetails: (summary?: string) => ReturnType;
    };
  }
}
