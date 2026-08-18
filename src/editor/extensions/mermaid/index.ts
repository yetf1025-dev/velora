import { ReactNodeViewRenderer } from "@tiptap/react";
import { MermaidNode } from "./MermaidNode";
import { MermaidView } from "./MermaidView";

/** 带 React NodeView 的完整 Mermaid 扩展 */
export const Mermaid = MermaidNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidView);
  },
});
