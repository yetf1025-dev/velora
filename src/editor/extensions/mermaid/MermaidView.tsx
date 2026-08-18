import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Pencil, AlertTriangle } from "lucide-react";
import { renderDiagram } from "../../../diagram/engine";
import { scheduleRender } from "../../../diagram/renderScheduler";
import { resolveThemeId } from "../../../diagram/themes";
import { useAppStore } from "../../../state/appStore";

/**
 * Mermaid NodeView:默认展示渲染后的图,点击编辑按钮进入源码编辑。
 * 渲染失败显示错误条并保留源码,不破坏文档。
 */
export function MermaidView({
  node,
  editor,
  getPos,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const source = (node.attrs.source as string) ?? "";
  const nodeTheme = (node.attrs.theme as string | null) ?? null;
  const appTheme = useAppStore((s) => s.theme);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const themeId = resolveThemeId(nodeTheme, appTheme);

  useEffect(() => {
    if (editing) return;
    const seq = ++seqRef.current;
    let cancelled = false;
    // 经调度器:限制每帧并发渲染数,避免大量图同时渲染卡主线程
    scheduleRender(async () => {
      if (cancelled || seq !== seqRef.current) return;
      const result = await renderDiagram(source, themeId);
      if (cancelled || seq !== seqRef.current) return;
      if (result.ok && result.svg) {
        setSvg(result.svg);
        setError(null);
      } else {
        setError(result.error ?? "渲染失败");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source, themeId, editing]);

  const commitDraft = useCallback(() => {
    setEditing(false);
    if (draft !== source) {
      updateAttributes({ source: draft });
    }
  }, [draft, source, updateAttributes]);

  return (
    <NodeViewWrapper
      className="vl-mermaid"
      data-selected={selected || undefined}
      data-drag-handle
      onMouseDownCapture={(e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (typeof pos !== "number") return;
        e.preventDefault();
        editor.commands.setNodeSelection(pos);
        // PM 的 mousedown 选区逻辑在冒泡阶段仍会执行并可能覆盖,
        // 等它结算后再断言一次,确保 NodeSelection 生效
        requestAnimationFrame(() => {
          editor.commands.setNodeSelection(pos);
        });
      }}
    >
      {editing ? (
        <textarea
          className="vl-mermaid-source"
          autoFocus
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") commitDraft();
            if (e.key === "Escape") {
              setDraft(source);
              setEditing(false);
            }
          }}
        />
      ) : error ? (
        <button
          type="button"
          className="vl-mermaid-error"
          onClick={() => {
            setDraft(source);
            setEditing(true);
          }}
          title="点击编辑源码"
        >
          <AlertTriangle size={14} />
          <span>Mermaid 渲染失败:{error}</span>
        </button>
      ) : (
        <div
          className="vl-mermaid-diagram"
          // SVG 来自 mermaid strict 模式渲染,非用户原始 HTML
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
      )}

      {!editing && (
        <button
          type="button"
          className="vl-mermaid-edit"
          title="编辑 Mermaid 源码"
          onClick={() => {
            setDraft(source);
            setEditing(true);
          }}
        >
          <Pencil size={12} />
        </button>
      )}
    </NodeViewWrapper>
  );
}
