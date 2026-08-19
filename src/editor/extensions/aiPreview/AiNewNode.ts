/**
 * AiNewNode —— AI 新增内容的绿底标记块(与 aiDelete 对称,GitHub diff +)。
 * 存在于 aiPreview 容器内:应用时解开转正,拒绝时删除。
 */
import type { JSONContent, MarkdownRendererHelpers, RenderContext } from "@tiptap/core";
import { Node } from "@tiptap/core";

export const AiNewNode = Node.create({
  name: "aiNew",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="ai-new"]' }];
  },

  renderHTML() {
    return ["div", { "data-type": "ai-new" }, 0];
  },

  // 序列化输出内容本身(临时标记,不持久化)
  renderMarkdown(
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    _ctx: RenderContext,
  ): string {
    return helpers.renderChildren(node.content ?? [], "\n\n");
  },
});
