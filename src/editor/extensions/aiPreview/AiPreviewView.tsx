import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Check, X } from "lucide-react";

/**
 * AI 预览块 NodeView:背景色高亮 + 右上角 应用/拒绝。
 *
 * 容器内可能含 aiDelete 子块(替换预览的旧内容):
 * - 应用:先删 aiDelete 块,再解开 aiPreview(新内容转正)
 * - 拒绝:先解开 aiDelete(旧内容恢复为正常),再删 aiPreview(新内容删)
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
        // 1. 从后往前删 aiDelete 子块(避免位置偏移),用删除后的 doc 重读位置
        const delRanges: { from: number; to: number }[] = [];
        cur.forEach((child, offset) => {
          if (child.type.name === "aiDelete") {
            delRanges.push({ from: pos + 1 + offset, to: pos + 1 + offset + child.nodeSize });
          }
        });
        for (const r of delRanges.reverse()) {
          tr.delete(r.from, r.to);
        }
        // 2. 删除后 aiPreview 起始位置不变(删除都在其内部/之后),直接在当前 doc 重读
        const cur2 = tr.doc.nodeAt(pos);
        if (cur2 && cur2.type.name === "aiPreview") {
          tr.replaceWith(pos, pos + cur2.nodeSize, cur2.content);
        }
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
        // 1. 解开所有 aiDelete(旧内容恢复为正常块),从后往前
        const unwraps: number[] = [];
        cur.forEach((child, offset) => {
          if (child.type.name === "aiDelete") unwraps.push(pos + 1 + offset);
        });
        for (const childPos of unwraps.reverse()) {
          const node = tr.doc.nodeAt(childPos);
          if (node && node.type.name === "aiDelete") {
            tr.replaceWith(childPos, childPos + node.nodeSize, node.content);
          }
        }
        // 2. 删 aiPreview(连带新内容),aiDelete 已解开为正常内容会被一并保留
        const cur2 = tr.doc.nodeAt(pos);
        if (cur2 && cur2.type.name === "aiPreview") {
          tr.delete(pos, pos + cur2.nodeSize);
        }
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
          title="应用(新内容转正,标记删除的移除)"
          onClick={apply}
        >
          <Check size={13} /> 应用
        </button>
        <button
          type="button"
          className="vl-ai-preview-reject"
          title="拒绝(恢复原内容)"
          onClick={reject}
        >
          <X size={13} />
        </button>
      </div>
      <NodeViewContent className="vl-ai-preview-content" />
    </NodeViewWrapper>
  );
}
