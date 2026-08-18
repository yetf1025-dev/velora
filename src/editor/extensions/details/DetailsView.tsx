import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { ChevronRight } from "lucide-react";

/**
 * Details NodeView:折叠块。
 * 三角箭头切换 open;summary 直接编辑;内容是正常的块级编辑区域。
 */
export function DetailsView({ node, updateAttributes }: NodeViewProps) {
  const open = node.attrs.open as boolean;
  const summary = (node.attrs.summary as string) ?? "";

  return (
    <NodeViewWrapper className="vl-details" data-open={open || undefined}>
      <div className="vl-details-header" contentEditable={false}>
        <button
          type="button"
          className="vl-details-toggle"
          onClick={() => updateAttributes({ open: !open })}
          title={open ? "折叠" : "展开"}
        >
          <ChevronRight
            size={14}
            style={{
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform var(--vl-transition)",
            }}
          />
        </button>
        <input
          className="vl-details-summary"
          value={summary}
          placeholder="折叠标题"
          onChange={(e) => updateAttributes({ summary: e.target.value })}
        />
      </div>
      {/*
        NodeViewContent 必须始终挂载:卸载后 ProseMirror 找不到内容挂载点,
        会把子节点渲染到错误位置(表现为“折叠了内容却直接显示”)。
        折叠只是视觉隐藏。
      */}
      <NodeViewContent
        className="vl-details-content"
        style={open ? undefined : { display: "none" }}
      />
    </NodeViewWrapper>
  );
}
