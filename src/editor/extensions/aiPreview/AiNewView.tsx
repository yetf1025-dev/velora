import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";

/** AI 新增标记块:绿底 + 号,替换预览的新内容 */
export function AiNewView(_props: NodeViewProps) {
  return (
    <NodeViewWrapper className="vl-ai-new">
      <NodeViewContent className="vl-ai-new-content" />
    </NodeViewWrapper>
  );
}
