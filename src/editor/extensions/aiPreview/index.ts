import { ReactNodeViewRenderer } from "@tiptap/react";
import { AiPreviewNode } from "./AiPreviewNode";
import { AiPreviewView } from "./AiPreviewView";
import { AiDeleteNode } from "./AiDeleteNode";
import { AiDeleteView } from "./AiDeleteView";

/** AI 预览块(应用/拒绝) */
export const AiPreview = AiPreviewNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AiPreviewView);
  },
});

/** AI 删除标记块(替换预览中被删的旧内容) */
export const AiDelete = AiDeleteNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AiDeleteView);
  },
});
