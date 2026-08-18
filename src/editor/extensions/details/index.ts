import { ReactNodeViewRenderer } from "@tiptap/react";
import { DetailsNode } from "./DetailsNode";
import { DetailsView } from "./DetailsView";

/** 带 React NodeView 的 Details 折叠块扩展 */
export const Details = DetailsNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(DetailsView);
  },
});
