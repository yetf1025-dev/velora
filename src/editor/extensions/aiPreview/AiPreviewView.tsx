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
        // 从后往前:删 aiDelete(旧内容),解开 aiNew(新内容转正)
        const ops: { pos: number; kind: "del" | "unwrap" }[] = [];
        cur.forEach((child, offset) => {
          if (child.type.name === "aiDelete") ops.push({ pos: pos + 1 + offset, kind: "del" });
          if (child.type.name === "aiNew") ops.push({ pos: pos + 1 + offset, kind: "unwrap" });
        });
        for (const op of ops.reverse()) {
          const node = tr.doc.nodeAt(op.pos);
          if (!node) continue;
          if (op.kind === "del") {
            tr.delete(op.pos, op.pos + node.nodeSize);
          } else {
            tr.replaceWith(op.pos, op.pos + node.nodeSize, node.content);
          }
        }
        // 解开 aiPreview 容器
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
        // 从后往前:解开 aiDelete(原文恢复),删 aiNew(新内容)
        const ops: { pos: number; kind: "del" | "unwrap" }[] = [];
        cur.forEach((child, offset) => {
          if (child.type.name === "aiDelete") ops.push({ pos: pos + 1 + offset, kind: "unwrap" });
          if (child.type.name === "aiNew") ops.push({ pos: pos + 1 + offset, kind: "del" });
        });
        for (const op of ops.reverse()) {
          const node = tr.doc.nodeAt(op.pos);
          if (!node) continue;
          if (op.kind === "del") {
            tr.delete(op.pos, op.pos + node.nodeSize);
          } else {
            tr.replaceWith(op.pos, op.pos + node.nodeSize, node.content);
          }
        }
        // 删容器(此时应只剩恢复的原文;若只剩原文则整个容器解开亦可)
        const cur2 = tr.doc.nodeAt(pos);
        if (cur2 && cur2.type.name === "aiPreview") {
          tr.replaceWith(pos, pos + cur2.nodeSize, cur2.content);
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
