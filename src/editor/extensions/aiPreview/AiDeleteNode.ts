/**
 * AiDeleteNode —— 替换预览中被替换掉的旧内容(红色删除标记)。
 * 存在于 aiPreview 容器内:应用时删除,拒绝时恢复(解开)。
 */
import type { JSONContent, MarkdownRendererHelpers, RenderContext } from "@tiptap/core";
import { Node } from "@tiptap/core";

export const AiDeleteNode = Node.create({
  name: "aiDelete",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="ai-delete"]' }];
  },

  renderHTML() {
    return ["div", { "data-type": "ai-delete" }, 0];
  },

  // 序列化时输出内容本身(aiDelete 是临时标记,存盘不保留)
  renderMarkdown(
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    _ctx: RenderContext,
  ): string {
    return helpers.renderChildren(node.content ?? [], "\n\n");
  },
});
