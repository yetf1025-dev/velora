/**
 * MermaidNode —— Mermaid 是 Velora 的一等公民 Document Node(ADR-001)。
 *
 * Markdown 映射:
 *   ```mermaid 代码块 ↔ mermaid 节点(source 存原始 mermaid 源码)
 * 其他语言的 code token 交还给内置 codeBlock 处理器。
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

export interface MermaidAttrs {
  source: string;
  /** null = 跟随文档亮暗模式自动选择 */
  theme: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mermaid: {
      /** 在当前位置插入 Mermaid 图 */
      insertMermaid: (source?: string) => ReturnType;
    };
  }
}

export const MermaidNode = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,
  selectable: true,
  // 高于内置 codeBlock,确保 code token 先经过我们
  priority: 200,

  addAttributes() {
    return {
      source: { default: "" },
      theme: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },

  renderHTML() {
    return ["div", { "data-type": "mermaid" }];
  },

  addCommands() {
    return {
      insertMermaid:
        (source = "graph LR\n    A[开始] --> B[结束]") =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { source, theme: null },
          }),
    };
  },

  // ── Markdown 映射(@tiptap/markdown) ─────────────────────
  markdownTokenName: "code",

  parseMarkdown(
    token: MarkdownToken,
    _helpers: MarkdownParseHelpers,
  ): MarkdownParseResult {
    // 返回 null 表示“我不认领这个 token”,管理器会继续尝试后续 handler
    // (类型定义未包含 null,但运行时约定如此,见 MarkdownManager.parseToken)
    if (token.lang !== "mermaid") return null as unknown as MarkdownParseResult;
    return {
      type: "mermaid",
      attrs: { source: token.text ?? "", theme: null },
    };
  },

  renderMarkdown(
    node: JSONContent,
    _helpers: MarkdownRendererHelpers,
    _ctx: RenderContext,
  ): string {
    const source = (node.attrs?.source as string) ?? "";
    return "```mermaid\n" + source.replace(/\n+$/, "") + "\n```";
  },
});
