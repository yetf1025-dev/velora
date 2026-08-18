import { ReactNodeViewRenderer } from "@tiptap/react";
import { SvgBlockParser, SvgNode } from "./SvgNode";
import { SvgView } from "./SvgView";

/** 带 React NodeView 的 SVG 扩展 */
export const Svg = SvgNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SvgView);
  },
});

export { SvgBlockParser };
