import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus, X } from "lucide-react";
import { useAppStore } from "../state/appStore";

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

/**
 * 图表放大查看器(应用级,SVG 与 Mermaid 共用)。
 * - 滚轮缩放 / +− 按钮 / 百分比显示 / 双击适应窗口
 * - 拖拽平移(放大后)
 * - Esc / 点背景 / ✕ 关闭;打开时压暗两侧面板
 */
export function SvgZoomOverlay() {
  const svg = useAppStore((s) => s.zoomSvg);
  const setZoomSvg = useAppStore((s) => s.setZoomSvg);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (svg === null) return;
    setScale(1);
    setOffset({ x: 0, y: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomSvg(null);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const next = e.deltaY < 0 ? s * 1.15 : s / 1.15;
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      });
    };
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setOffset({ x: d.baseX + (e.clientX - d.startX), y: d.baseY + (e.clientY - d.startY) });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [svg, setZoomSvg]);

  /** 适应窗口:按内容与视口比例算初始缩放 */
  const fitToWindow = useCallback(() => {
    const el = contentRef.current?.querySelector("svg");
    if (!el) return;
    const vb = el.viewBox?.baseVal;
    const w = vb?.width || el.getBoundingClientRect().width;
    const h = vb?.height || el.getBoundingClientRect().height;
    if (!w || !h) return;
    const fit = Math.min((window.innerWidth * 0.85) / w, (window.innerHeight * 0.8) / h, 1);
    setScale(Math.max(MIN_SCALE, fit));
    setOffset({ x: 0, y: 0 });
  }, []);

  if (svg === null) return null;

  return (
    <div
      className="vl-svg-overlay"
      onClick={() => setZoomSvg(null)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        fitToWindow();
      }}
    >
      <button
        type="button"
        className="vl-svg-overlay-close"
        title="关闭 (Esc)"
        onClick={(e) => {
          e.stopPropagation();
          setZoomSvg(null);
        }}
      >
        <X size={16} />
      </button>

      {/* 缩放控制条 */}
      <div
        className="vl-zoom-controls"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button type="button" title="缩小" onClick={() => setScale((s) => Math.max(MIN_SCALE, s / 1.25))}>
          <Minus size={13} />
        </button>
        <span className="vl-zoom-percent">{Math.round(scale * 100)}%</span>
        <button type="button" title="放大" onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.25))}>
          <Plus size={13} />
        </button>
        <button type="button" title="适应窗口(双击图片同)" onClick={fitToWindow}>
          <Maximize size={13} />
        </button>
      </div>

      <div
        ref={contentRef}
        className="vl-svg-overlay-content"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: scale > 1 ? "grab" : "default",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          if (scale <= 1) return;
          e.preventDefault();
          dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <div className="vl-zoom-hint">滚轮缩放 · 拖拽平移 · 双击适应窗口 · Esc 关闭</div>
    </div>
  );
}
