import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";

/** AI 删除标记块:被替换的旧内容,红色删除线显示 */
export function AiDeleteView(_props: NodeViewProps) {
  return (
    <NodeViewWrapper className="vl-ai-delete">
      <div className="vl-ai-delete-badge" contentEditable={false}>
        将被删除
      </div>
      <NodeViewContent className="vl-ai-delete-content" />
    </NodeViewWrapper>
  );
}
