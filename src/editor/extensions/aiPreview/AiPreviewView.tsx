import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Check, X } from "lucide-react";

/**
 * AI 预览块 NodeView:背景色高亮 + 右上角 应用/拒绝。
 * 应用:把容器替换为它的内容(转正);拒绝:整块删除。
 */
export function AiPreviewView({ editor, getPos }: NodeViewProps) {
  const apply = () => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (typeof pos !== "number") return;
    editor
      .chain()
      .command(({ tr, state }) => {
        const cur = state.doc.nodeAt(pos);
        if (!cur || cur.type.name !== "aiPreview") return false;
        // 容器替换为其内容:预览转正
        tr.replaceWith(pos, pos + cur.nodeSize, cur.content);
        return true;
      })
      .run();
  };

  const reject = () => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (typeof pos !== "number") return;
    editor
      .chain()
      .command(({ tr, state }) => {
        const cur = state.doc.nodeAt(pos);
        if (!cur || cur.type.name !== "aiPreview") return false;
        tr.delete(pos, pos + cur.nodeSize);
        return true;
      })
      .run();
  };

  return (
    <NodeViewWrapper className="vl-ai-preview" data-drag-handle>
      <div className="vl-ai-preview-badge">AI 建议</div>
      <div className="vl-ai-preview-actions" contentEditable={false}>
        <button
          type="button"
          className="vl-ai-preview-apply"
          title="应用(内容转正)"
          onClick={apply}
        >
          <Check size={13} /> 应用
        </button>
        <button
          type="button"
          className="vl-ai-preview-reject"
          title="拒绝(删除)"
          onClick={reject}
        >
          <X size={13} />
        </button>
      </div>
      <NodeViewContent className="vl-ai-preview-content" />
    </NodeViewWrapper>
  );
}
