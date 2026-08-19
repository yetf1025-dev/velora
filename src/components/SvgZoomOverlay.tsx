import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../state/appStore";

/**
 * SVG 放大查看 overlay(应用级)。
 * 渲染在 App 顶层(与设置对话框同层),天然位于两侧面板之上、
 * 不在编辑器 DOM 内,不触发选区/BubbleMenu 等编辑器交互。
 * 滚轮缩放,Esc/点背景/✕ 关闭;打开时压暗两侧面板。
 */
export function SvgZoomOverlay() {
  const svg = useAppStore((s) => s.svgZoom);
  const setSvgZoom = useAppStore((s) => s.setSvgZoom);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (svg === null) return;
    setScale(1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSvgZoom(null);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const next = e.deltaY < 0 ? s * 1.15 : s / 1.15;
        return Math.min(8, Math.max(0.2, next));
      });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [svg, setSvgZoom]);

  if (svg === null) return null;

  return (
    <div className="vl-svg-overlay" onClick={() => setSvgZoom(null)}>
      <button
        type="button"
        className="vl-svg-overlay-close"
        title="关闭 (Esc)"
        onClick={(e) => {
          e.stopPropagation();
          setSvgZoom(null);
        }}
      >
        <X size={16} />
      </button>
      <div
        className="vl-svg-overlay-content"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
