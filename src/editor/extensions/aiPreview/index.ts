import { ReactNodeViewRenderer } from "@tiptap/react";
import { AiPreviewNode } from "./AiPreviewNode";
import { AiPreviewView } from "./AiPreviewView";

/** 带 React NodeView 的 AI 预览块扩展 */
export const AiPreview = AiPreviewNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AiPreviewView);
  },
});
