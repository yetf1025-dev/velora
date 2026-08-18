import { useCallback, useRef, useState } from "react";

/**
 * 面板拖拽调宽 hook。
 * side: "left" 面板在左(右缘拖拽增宽);"right" 面板在右(左缘拖拽增宽)
 */
export function usePanelResize(
  side: "left" | "right",
  initial: number,
  min = 180,
  max = 600,
) {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX;
        const next = side === "left" ? startWidth + delta : startWidth - delta;
        setWidth(Math.min(max, Math.max(min, next)));
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [side, width, min, max],
  );

  return { width, onMouseDown };
}
