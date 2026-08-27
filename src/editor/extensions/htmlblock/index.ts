import { ReactNodeViewRenderer } from "@tiptap/react";
import { HtmlBlock, HtmlBlockParser } from "./HtmlNode";
import { HtmlBlockView } from "./HtmlBlockView";

/** 带 React NodeView 的 HTML 块扩展(fallback 渲染) */
export const Html = HtmlBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(HtmlBlockView);
  },
});

export { HtmlBlockParser };
