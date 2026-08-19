import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { AlertTriangle, Code, ZoomIn } from "lucide-react";
import { readTextFile, writeTextFile } from "../../../platform/fileService";
import { useAppStore } from "../../../state/appStore";
import { useSvgRefreshStore } from "./svgRefresh";

/**
 * SVG NodeView:专用渲染容器,与文档排版 CSS 隔离。
 * - 内联 SVG(attrs.source)直接渲染
 * - 文件引用(attrs.src)经平台层读取源文件后内联渲染
 * - 双击进入源码查看;文件来源可编辑并显式保存回 .svg 文件
 */
export function SvgView({
  node,
  editor,
  getPos,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const src = (node.attrs.src as string | null) ?? null;
  const inlineSource = (node.attrs.source as string | null) ?? null;
  const currentFilePath = useAppStore((s) => s.currentFilePath);
  const refreshVersion = useSvgRefreshStore((s) => s.version);

  const [svg, setSvg] = useState<string | null>(inlineSource);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const editingRef = useRef<HTMLDivElement | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (inlineSource) {
      setSvg(inlineSource);
      setError(null);
      return;
    }
    if (!src) return;
    if (!currentFilePath) {
      setError("先保存当前文档,才能解析相对路径的 SVG 文件");
      return;
    }
    let cancelled = false;
    const absPath = resolveRelative(currentFilePath, src);
    readTextFile(absPath)
      .then((content) => {
        if (cancelled) return;
        setSvg(content);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [src, inlineSource, currentFilePath, refreshVersion]);

  const commit = useCallback(async () => {
    setEditing(false);
    if (draft === svg) return;
    if (inlineSource !== null) {
      // 内联 SVG:写回节点属性,随 markdown 序列化
      updateAttributes({ source: draft });
      setSvg(draft);
    } else if (src && currentFilePath) {
      // 文件来源:显式保存回 .svg 文件
      await writeTextFile(resolveRelative(currentFilePath, src), draft);
      setSvg(draft);
    }
  }, [draft, svg, inlineSource, src, currentFilePath, updateAttributes]);

  // 编辑中:Esc 关闭 / 点编辑区域外提交并回到图片
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (editingRef.current && !editingRef.current.contains(e.target as Node)) {
        void commit();
      }
    };
    window.addEventListener("keydown", onKey);
    // 捕获阶段:早于其他点击处理,避免触发画布编辑等
    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [editing, commit]);

  const startEdit = useCallback(() => {
    setDraft(svg ?? "");
    setEditing(true);
  }, [svg]);

  return (
    <NodeViewWrapper
      className="vl-svg"
      data-selected={selected || undefined}
      // 不在外层设选区/拖拽,避免吞掉子元素的 mousedown → 单/双击判定失效。
      // 选区与单双击都在 .vl-svg-canvas 的 mousedown 里处理。
    >
      <div className="vl-svg-drag-strip" data-drag-handle />
      {editing ? (
        <div className="vl-svg-editing" ref={editingRef}>
          <textarea
            className="vl-svg-source"
            autoFocus
            value={draft}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void commit();
            }}
          />
          <div className="vl-svg-editing-hint">
            ⌘Enter {inlineSource !== null ? "应用" : "保存回 " + src} · Esc 或点外部取消
          </div>
        </div>
      ) : error ? (
        <div className="vl-svg-error">
          <AlertTriangle size={14} />
          <span>SVG 加载失败:{error}</span>
        </div>
      ) : (
        <div
          className="vl-svg-canvas"
          // PM 在 setNodeSelection 后会吞掉 click 派发,因此单/双击判定
          // 自己在 mousedown 上做(不依赖 click/dblclick 事件)
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            // 设选区(这里设,不阻断后续单/双击判定)
            const pos = typeof getPos === "function" ? getPos() : undefined;
            if (typeof pos === "number") {
              editor.commands.setNodeSelection(pos);
              requestAnimationFrame(() => editor.commands.setNodeSelection(pos));
            }
            const now = Date.now();
            const canvas = e.currentTarget;
            const last = (canvas as HTMLDivElement & { __vlLastDown?: number }).__vlLastDown ?? 0;
            if (now - last < 300) {
              // 双击 → 编辑
              if (clickTimer.current) {
                clearTimeout(clickTimer.current);
                clickTimer.current = null;
              }
              (canvas as HTMLDivElement & { __vlLastDown?: number }).__vlLastDown = 0;
              startEdit();
            } else {
              (canvas as HTMLDivElement & { __vlLastDown?: number }).__vlLastDown = now;
              if (clickTimer.current) clearTimeout(clickTimer.current);
              clickTimer.current = setTimeout(() => {
                clickTimer.current = null;
                if (svg) useAppStore.getState().setSvgZoom(svg);
              }, 280);
            }
          }}
          title="单击放大 · 双击编辑源码 · 滚轮缩放"
          // SVG 来自用户自己的文档/文件,经隔离容器渲染,不走 HTML 排版链
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
      )}

      {!editing && !error && (
        <>
          <button
            type="button"
            className="vl-svg-zoom"
            title="放大查看"
            onClick={() => svg && useAppStore.getState().setSvgZoom(svg)}
          >
            <ZoomIn size={12} />
          </button>
          <button
            type="button"
            className="vl-svg-code"
            title="查看 SVG 源码"
            onClick={startEdit}
          >
            <Code size={12} />
          </button>
        </>
      )}

    </NodeViewWrapper>
  );
}

/** 解析相对当前文档的资源路径(浏览器环境无 path 库,手写规范化) */
export function resolveRelative(baseFile: string, rel: string): string {
  if (rel.startsWith("/")) return rel;
  const baseDir = baseFile.slice(0, baseFile.lastIndexOf("/"));
  const parts = (baseDir + "/" + rel).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return "/" + out.join("/");
}
