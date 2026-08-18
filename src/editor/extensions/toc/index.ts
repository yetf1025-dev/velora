import { ReactNodeViewRenderer } from "@tiptap/react";
import { TocNode } from "./TocNode";
import { TocView } from "./TocView";

/** 带 React NodeView 的 TOC 扩展 */
export const Toc = TocNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TocView);
  },
});
