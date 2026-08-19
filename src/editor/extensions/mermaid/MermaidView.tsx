import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Pencil, AlertTriangle, Sparkles, Loader2, ZoomIn } from "lucide-react";
import { renderDiagram } from "../../../diagram/engine";
import { scheduleRender } from "../../../diagram/renderScheduler";
import { resolveThemeId } from "../../../diagram/themes";
import { aiOnMermaid } from "../../../ai/aiService";
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

  const svgRef = useRef<string | null>(null);
  svgRef.current = svg;
  // 渐进式单击:未选中 → 选中(Inspector 出面板);已选中 → 放大。
  // 用 selected prop 判定(响应式,不依赖时序状态——PM 重建 DOM/严格模式
  // 双挂都不会影响),角标按钮仍是显式入口
  const onMouseDownDiagram = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (typeof pos !== "number") return;
    if (selected) {
      // 已选中:这次单击直接放大
      const svgNow = svgRef.current;
      if (svgNow) {
        e.preventDefault();
        useAppStore.getState().setZoomSvg(svgNow);
        return;
      }
    }
    editor.commands.setNodeSelection(pos);
    requestAnimationFrame(() => editor.commands.setNodeSelection(pos));
  };

  const commitDraft = useCallback(() => {
    setEditing(false);
    if (draft !== source) {
      updateAttributes({ source: draft });
    }
  }, [draft, source, updateAttributes]);

  // AI 修复:把渲染报错 + 源码发给 AI 修正语法,成功直接更新(⌘Z 可撤销)
  const [fixing, setFixing] = useState(false);
  const fixWithAi = useCallback(async () => {
    setFixing(true);
    try {
      const fixed = await aiOnMermaid(
        source,
        `此 Mermaid 源码渲染失败,报错如下,请修正语法错误(保持图的语义与内容不变,只修语法):\n${error}`,
      );
      // 先本地验证修好了再写入
      const check = await renderDiagram(fixed, themeId);
      if (!check.ok) {
        setError(`AI 修复后仍无法渲染:${check.error}`);
        return;
      }
      setError(null);
      updateAttributes({ source: fixed });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFixing(false);
    }
  }, [source, error, themeId, updateAttributes]);

  return (
    <NodeViewWrapper
      className="vl-mermaid"
      data-selected={selected || undefined}
      // drag-handle 不放外层(会吞 click → 单击放大失效),由拖拽条承担
      onMouseDownCapture={(e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (typeof pos !== "number") return;
        // 不 preventDefault:它会吞掉后续 click,单击放大就失效了。
        // 选中靠捕获段 set + rAF 重断言(冒泡段 PM 可能覆盖)。
        editor.commands.setNodeSelection(pos);
        requestAnimationFrame(() => {
          editor.commands.setNodeSelection(pos);
        });
      }}
    >
      <div className="vl-mermaid-drag-strip" data-drag-handle />
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
        <div className="vl-mermaid-error-wrap">
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
          <button
            type="button"
            className="vl-mermaid-aifix"
            disabled={fixing}
            onClick={() => void fixWithAi()}
            title="把报错和源码发给 AI,自动修正语法后重新渲染"
          >
            {fixing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {fixing ? "修复中…" : "AI 修复"}
          </button>
        </div>
      ) : (
        <div
          className="vl-mermaid-diagram"
          title="单击选中,再单击放大 · 角标按钮编辑"
          onMouseDown={onMouseDownDiagram}
          // SVG 来自 mermaid strict 模式渲染,非用户原始 HTML
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
      )}

      {!editing && !error && (
        <>
          <button
            type="button"
            className="vl-mermaid-zoom"
            title="放大查看(滚轮缩放/拖拽平移)"
            onClick={() => {
              if (svg) useAppStore.getState().setZoomSvg(svg);
            }}
          >
            <ZoomIn size={12} />
          </button>
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
        </>
      )}
    </NodeViewWrapper>
  );
}
