/**
 * AiPreviewNode —— AI 生成内容的编辑区就地预览块。
 *
 * 结构:容器块(content: block+),内部是已解析的正式内容节点。
 * 应用 = 解开容器(内容转正);拒绝 = 整块删除。
 * 序列化为 markdown 时写回内容本身(预览块不持久化语义)。
 */
import type {
  JSONContent,
  MarkdownParseResult,
  MarkdownRendererHelpers,
  RenderContext,
} from "@tiptap/core";
import { Node } from "@tiptap/core";

export const AiPreviewNode = Node.create({
  name: "aiPreview",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="ai-preview"]' }];
  },

  renderHTML() {
    return ["div", { "data-type": "ai-preview" }, 0];
  },

  // 预览块不应对外存为特殊标记;序列化时输出内容本身。
  // (预览块是会话内临时状态,存盘前通常已被应用/拒绝)
  markdownTokenName: "aiPreview",

  parseMarkdown(): MarkdownParseResult {
    return null as unknown as MarkdownParseResult;
  },

  renderMarkdown(
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    _ctx: RenderContext,
  ): string {
    return helpers.renderChildren(node.content ?? [], "\n\n");
  },
});
