import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Circle,
  Diamond,
  Grid3x3,
  Magnet,
  Maximize,
  MoveRight,
  Redo2,
  Spline,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/**
 * SVG 画布编辑器。
 *
 * 能力:
 * - 拖拽移动(从属文字/连线端点联动)/ 右下角手柄缩放
 * - Undo / Redo(快照式,⌘Z / ⇧⌘Z)
 * - 连接点:选中元素四边中点,拖出即连线(带箭头,端点吸附目标边缘)
 * - 框选(空白处拖出选框)+ ⌘点击多选;多选可整体移动/删除
 * - 画布缩放用 width/height 尺寸(不用 CSS transform,避免 WebKit 合成层重绘问题)
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  svgSource: string;
  onSave: (next: string) => void | Promise<void>;
}

interface SelectedInfo {
  tag: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
  text: string;
  fontSize: string;
}

interface AttachedLink {
  el: SVGGraphicsElement;
  kind: "whole" | "start" | "end";
  orig: Record<string, number>;
  origD?: string;
  origPoints?: string;
}

type DragMode = "move" | "resize" | "marquee" | "connect";

interface DragState {
  mode: DragMode;
  /** move/resize 的目标;connect 的源元素 */
  el: SVGGraphicsElement | null;
  startX: number;
  startY: number;
  /** move(单选或组)/resize 的属性快照 */
  origMap: Map<SVGGraphicsElement, Record<string, number>>;
  transformMap: Map<SVGGraphicsElement, string>;
  bbox: { x: number; y: number; width: number; height: number };
  links: AttachedLink[];
  /** connect: 临时连线 + 起点(SVG 坐标)+ 源连接点方向(0上1右2下3左) */
  tempLine?: SVGLineElement;
  startPoint?: { x: number; y: number };
  startSide?: number;
  /** connect 落点锚定的目标元素(用于生成会话内锚定记录) */
  targetEl?: SVGGraphicsElement | null;
  /** 拖拽前快照(结束时若有变化则入 undo 栈) */
  beforeSnapshot?: string;
}

import { shapeIntersection, type Box, type ShapeKind } from "./shapeIntersection";

const NS = "http://www.w3.org/2000/svg";
const SHAPE_SELECTOR =
  "rect,circle,ellipse,text,path,line,polyline,polygon,image,g";

/** 形状识别:从元素推断相交计算用的形状类型 */
function shapeKindOf(el: SVGGraphicsElement): ShapeKind | null {
  const tag = el.tagName.toLowerCase();
  if (tag === "ellipse" || tag === "circle") return "ellipse";
  if (el.getAttribute("data-vl-shape") === "diamond" || tag === "polygon") {
    // 标记为菱形的 polygon,或裸 polygon 当菱形处理
    return "diamond";
  }
  if (["rect", "image", "text"].includes(tag)) return "rect";
  return null;
}

/** 会话内连线锚定(D2):polyline 上挂 __vlStart/__vlEnd 元素引用 + __vlStartSide。
 *  不持久化——存盘剥离 data-vl-anchor,重新打开锚定丢失(已认账的 D2 代价)。 */

/** 拖动节点后,重算所有锚定到该节点的连线端点 + 正交折线 */
function rerouteAnchoredLines(movedEl: SVGGraphicsElement, screenToSvgFn: (x: number, y: number) => { x: number; y: number }) {
  const svgEl = movedEl.ownerSVGElement;
  if (!svgEl) return;
  const movedBox = shapeBoxOf(movedEl, screenToSvgFn);
  if (!movedBox) return;
  const movedKind = shapeKindOf(movedEl) ?? "rect";

  svgEl.querySelectorAll<SVGPolylineElement>("polyline[data-vl-anchor]").forEach((poly) => {
    const ref = poly as SVGPolylineElement & {
      __vlStart?: SVGGraphicsElement;
      __vlEnd?: SVGGraphicsElement | null;
      __vlStartSide?: number;
    };
    const startEl = ref.__vlStart;
    const endEl = ref.__vlEnd;
    if (startEl !== movedEl && endEl !== movedEl) return;

    const cur = parsePoints(poly.getAttribute("points") || "");
    if (cur.length < 2) return;

    // 本节点(被拖动的)那一端的精确落点:从中心射向对端当前点
    let startPt: { x: number; y: number };
    let endPt: { x: number; y: number };
    if (startEl === movedEl) {
      endPt = { x: cur[cur.length - 1][0], y: cur[cur.length - 1][1] };
      startPt = shapeIntersection(movedKind, movedBox, endPt);
    } else {
      startPt = { x: cur[0][0], y: cur[0][1] };
      endPt = shapeIntersection(movedKind, movedBox, startPt);
    }
    const startSide = startEl === movedEl ? ref.__vlStartSide : undefined;
    poly.setAttribute("points", orthoRoute(startPt, endPt, startSide).map((p) => p.join(",")).join(" "));
  });
}

function parsePoints(raw: string): Array<[number, number]> {
  return raw.trim().split(/[\s,]+/).reduce<Array<[number, number]>>((acc, _n, i, arr) => {
    if (i % 2 === 0 && arr[i] && arr[i + 1]) acc.push([+arr[i], +arr[i + 1]]);
    return acc;
  }, []);
}

/** 正交路由:按起点 side 决定先横后竖/先竖后横 */
function orthoRoute(start: { x: number; y: number }, end: { x: number; y: number }, startSide?: number): Array<[number, number]> {
  const horizontal = startSide === 1 || startSide === 3;
  const corner = horizontal ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
  return [
    [start.x, start.y],
    [corner.x, corner.y],
    [end.x, end.y],
  ];
}

/** 取形状的包围盒中心 + 半尺寸(SVG 坐标) */
function shapeBoxOf(el: SVGGraphicsElement, screenToSvg: (x: number, y: number) => { x: number; y: number }): Box | null {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  const tl = screenToSvg(r.left, r.top);
  const br = screenToSvg(r.right, r.bottom);
  return {
    cx: (tl.x + br.x) / 2,
    cy: (tl.y + br.y) / 2,
    hw: (br.x - tl.x) / 2,
    hh: (br.y - tl.y) / 2,
  };
}

export function SvgCanvasEditor({ open, onOpenChange, svgSource, onSave }: Props) {
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const baseSizeRef = useRef({ width: 0, height: 0 });
  const handleRef = useRef<SVGRectElement | null>(null);
  const connPointsRef = useRef<SVGCircleElement[]>([]);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const historyRef = useRef<{ undo: string[]; redo: string[] }>({ undo: [], redo: [] });

  const [sel, setSelState] = useState<SVGGraphicsElement[]>([]);
  const selRef = useRef<SVGGraphicsElement[]>([]);
  const [info, setInfo] = useState<SelectedInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [, setHistoryTick] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const snapRef = useRef(false);
  const [showGrid, setShowGrid] = useState(false);
  const clipboardRef = useRef<string[]>([]);
  const guidesRef = useRef<SVGLineElement[]>([]);
  const lastNudgeRef = useRef(0);
  const [textEdit, setTextEdit] = useState<{ el: SVGTextElement; x: number; y: number; value: string } | null>(null);

  const setSel = useCallback((els: SVGGraphicsElement[]) => {
    selRef.current = els;
    setSelState(els);
  }, []);

  useEffect(() => {
    snapRef.current = snapEnabled;
  }, [snapEnabled]);

  const single = sel.length === 1 ? sel[0] : null;

  // ── 序列化(剥离编辑器 UI:手柄/连接点/选中标记) ──────
  const serializeNow = useCallback((): string => {
    const svgEl = svgRef.current;
    if (!svgEl) return "";
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute("style");
    clone
      .querySelectorAll(".vl-resize-handle,.vl-conn-point,.vl-temp-line,.vl-guide,.vl-grid-layer")
      .forEach((n) => n.remove());
    clone.querySelectorAll("[data-vl-sel]").forEach((n) =>
      n.removeAttribute("data-vl-sel"),
    );
    // D2:剥离会话内锚定标记,存盘是干净静态 SVG
    clone.querySelectorAll("[data-vl-anchor]").forEach((n) =>
      n.removeAttribute("data-vl-anchor"),
    );
    return new XMLSerializer().serializeToString(clone);
  }, []);

  // ── 挂载 ──────────────────────────────────────────────
  const mountSvg = useCallback(
    (source: string) => {
      if (!hostEl) return;
      const cleaned = source.replace(/<\?xml[\s\S]*?\?>/, "").trim();
      hostEl.innerHTML = cleaned;
      const svgEl = hostEl.querySelector<SVGSVGElement>("svg");
      if (!svgEl) return;
      if (!svgEl.getAttribute("width") && svgEl.viewBox.baseVal.width) {
        svgEl.setAttribute("width", String(svgEl.viewBox.baseVal.width));
      }
      if (!svgEl.getAttribute("height") && svgEl.viewBox.baseVal.height) {
        svgEl.setAttribute("height", String(svgEl.viewBox.baseVal.height));
      }
      svgEl.style.maxWidth = "none";
      svgEl.style.cursor = "default";

      // 编辑器 UI:缩放手柄 + 4 个连接点
      const handle = document.createElementNS(NS, "rect");
      handle.setAttribute("class", "vl-resize-handle");
      handle.style.display = "none";
      svgEl.appendChild(handle);
      handleRef.current = handle;

      connPointsRef.current = [0, 1, 2, 3].map(() => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("class", "vl-conn-point");
        c.setAttribute("r", "4");
        c.style.display = "none";
        svgEl.appendChild(c);
        return c;
      });

      svgRef.current = svgEl;
    },
    [hostEl],
  );

  useEffect(() => {
    if (!open || !hostEl) return;
    mountSvg(svgSource);
    const svgEl = svgRef.current;
    if (svgEl) {
      baseSizeRef.current = {
        width: parseFloat(svgEl.getAttribute("width") ?? "0") || svgEl.viewBox.baseVal.width || 400,
        height: parseFloat(svgEl.getAttribute("height") ?? "0") || svgEl.viewBox.baseVal.height || 300,
      };
    }
    historyRef.current = { undo: [], redo: [] };
    setSel([]);
    setInfo(null);
    setZoom(1);
    return () => {
      svgRef.current = null;
      handleRef.current = null;
      connPointsRef.current = [];
    };
  }, [open, svgSource, hostEl, mountSvg, setSel]);

  // 缩放:改显示尺寸,不进合成层
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    svgEl.style.width = `${baseSizeRef.current.width * zoom}px`;
    svgEl.style.height = `${baseSizeRef.current.height * zoom}px`;
  }, [zoom]);

  // ── 坐标换算 ──────────────────────────────────────────
  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    const svgEl = svgRef.current;
    if (!svgEl) return { x: 0, y: 0 };
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }, []);

  const svgDelta = useCallback((dxScreen: number, dyScreen: number) => {
    const svgEl = svgRef.current;
    if (!svgEl) return { dx: 0, dy: 0 };
    const ctm = svgEl.getScreenCTM();
    const scale = ctm ? ctm.a : 1;
    return { dx: dxScreen / (scale || 1), dy: dyScreen / (scale || 1) };
  }, []);

  // ── 选中 / 手柄 / 连接点定位 ──────────────────────────
  const positionEditorUI = useCallback(
    (el: SVGGraphicsElement) => {
      const handle = handleRef.current;
      const points = connPointsRef.current;
      if (!handle) return;
      const rect = el.getBoundingClientRect();
      const tl = screenToSvg(rect.left, rect.top);
      const br = screenToSvg(rect.right, rect.bottom);
      const w = br.x - tl.x;
      const h = br.y - tl.y;
      const unit = Math.max(w / Math.max(rect.width, 1), 0.5);

      const size = 7 * unit;
      handle.setAttribute("width", String(size));
      handle.setAttribute("height", String(size));
      handle.setAttribute("x", String(br.x - size / 2));
      handle.setAttribute("y", String(br.y - size / 2));
      handle.style.display = "";

      // 上/右/下/左 四边中点
      const mids = [
        { x: tl.x + w / 2, y: tl.y },
        { x: br.x, y: tl.y + h / 2 },
        { x: tl.x + w / 2, y: br.y },
        { x: tl.x, y: tl.y + h / 2 },
      ];
      points.forEach((c, i) => {
        c.setAttribute("cx", String(mids[i].x));
        c.setAttribute("cy", String(mids[i].y));
        c.setAttribute("r", String(3.5 * unit));
        c.style.display = "";
      });
    },
    [screenToSvg],
  );

  /** 显示对齐参考线(SVG 坐标) */
  const showGuides = useCallback((lines: { v?: number; h?: number }) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    hideGuides();
    const vb = svgEl.viewBox.baseVal;
    const mk = (x1: number, y1: number, x2: number, y2: number) => {
      const l = document.createElementNS(NS, "line") as SVGLineElement;
      l.setAttribute("class", "vl-guide");
      l.setAttribute("x1", String(x1));
      l.setAttribute("y1", String(y1));
      l.setAttribute("x2", String(x2));
      l.setAttribute("y2", String(y2));
      svgEl.appendChild(l);
      guidesRef.current.push(l);
    };
    if (lines.v !== undefined) mk(lines.v, vb.y - 1000, lines.v, vb.y + vb.height + 1000);
    if (lines.h !== undefined) mk(vb.x - 1000, lines.h, vb.x + vb.width + 1000, lines.h);
  }, []);

  const hideGuides = useCallback(() => {
    guidesRef.current.forEach((l) => l.remove());
    guidesRef.current = [];
  }, []);

  /** 网格层切换 */
  const applyGrid = useCallback((on: boolean) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    svgEl.querySelector(".vl-grid-layer")?.remove();
    if (!on) return;
    const vb = svgEl.viewBox.baseVal;
    const g = 16;
    let defs = svgEl.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(NS, "defs");
      svgEl.prepend(defs);
    }
    let pattern = svgEl.querySelector("pattern#vl-grid");
    if (!pattern) {
      pattern = document.createElementNS(NS, "pattern");
      pattern.setAttribute("id", "vl-grid");
      pattern.setAttribute("width", String(g));
      pattern.setAttribute("height", String(g));
      pattern.setAttribute("patternUnits", "userSpaceOnUse");
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", "1");
      dot.setAttribute("cy", "1");
      dot.setAttribute("r", "1");
      dot.setAttribute("fill", "#a1a1aa");
      pattern.appendChild(dot);
      defs.appendChild(pattern);
    }
    const layer = document.createElementNS(NS, "rect");
    layer.setAttribute("class", "vl-grid-layer");
    layer.setAttribute("x", String(vb.x));
    layer.setAttribute("y", String(vb.y));
    layer.setAttribute("width", String(vb.width));
    layer.setAttribute("height", String(vb.height));
    layer.setAttribute("fill", "url(#vl-grid)");
    layer.setAttribute("opacity", "0.5");
    svgEl.insertBefore(layer, svgEl.firstChild);
  }, []);

  useEffect(() => {
    applyGrid(showGrid);
  }, [showGrid, applyGrid]);

  const hideEditorUI = useCallback(() => {
    if (handleRef.current) handleRef.current.style.display = "none";
    connPointsRef.current.forEach((c) => (c.style.display = "none"));
  }, []);

  const readInfo = useCallback((el: SVGGraphicsElement) => {
    const style = getComputedStyle(el);
    setInfo({
      tag: el.tagName.toLowerCase(),
      fill: el.getAttribute("fill") ?? style.fill ?? "",
      stroke: el.getAttribute("stroke") ?? style.stroke ?? "",
      strokeWidth: el.getAttribute("stroke-width") ?? "",
      text: el.tagName.toLowerCase() === "text" ? (el.textContent ?? "") : "",
      fontSize: el.getAttribute("font-size") ?? style.fontSize ?? "",
    });
  }, []);

  const select = useCallback(
    (els: SVGGraphicsElement[]) => {
      svgRef.current
        ?.querySelectorAll('[data-vl-sel="true"]')
        .forEach((n) => n.removeAttribute("data-vl-sel"));
      setSel(els);
      els.forEach((el) => el.setAttribute("data-vl-sel", "true"));
      if (els.length === 1) {
        readInfo(els[0]);
        positionEditorUI(els[0]);
      } else {
        setInfo(null);
        hideEditorUI();
      }
    },
    [setSel, readInfo, positionEditorUI, hideEditorUI],
  );

  // ── Undo / Redo ───────────────────────────────────────
  const pushHistory = useCallback((snapshot: string) => {
    const h = historyRef.current;
    h.undo.push(snapshot);
    if (h.undo.length > 50) h.undo.shift();
    h.redo = [];
    setHistoryTick((t) => t + 1);
  }, []);

  const restore = useCallback(
    (snapshot: string) => {
      mountSvg(snapshot);
      const svgEl = svgRef.current;
      if (svgEl) {
        svgEl.style.width = `${baseSizeRef.current.width * zoom}px`;
        svgEl.style.height = `${baseSizeRef.current.height * zoom}px`;
      }
      setSel([]);
      setInfo(null);
    },
    [mountSvg, zoom, setSel],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.undo.length) return;
    const snapshot = h.undo.pop()!;
    h.redo.push(serializeNow());
    restore(snapshot);
    setHistoryTick((t) => t + 1);
  }, [serializeNow, restore]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.redo.length) return;
    const snapshot = h.redo.pop()!;
    h.undo.push(serializeNow());
    restore(snapshot);
    setHistoryTick((t) => t + 1);
  }, [serializeNow, restore]);

  // ── 拖拽逻辑 ──────────────────────────────────────────
  useEffect(() => {
    const host = hostEl;
    const svgEl = svgRef.current;
    if (!open || !host || !svgEl) return;

    const snapshotAttrs = (el: SVGGraphicsElement): Record<string, number> => {
      const attrs: Record<string, number> = {};
      for (const attr of [
        "x", "y", "cx", "cy", "width", "height", "r", "rx", "ry",
        "x1", "y1", "x2", "y2", "font-size",
      ]) {
        const v = parseFloat(el.getAttribute(attr) ?? "");
        if (!Number.isNaN(v)) attrs[attr] = v;
      }
      return attrs;
    };

    const bboxOf = (el: SVGGraphicsElement) => {
      const rect = el.getBoundingClientRect();
      const topLeft = screenToSvg(rect.left, rect.top);
      const bottomRight = screenToSvg(rect.right, rect.bottom);
      return {
        x: topLeft.x,
        y: topLeft.y,
        width: Math.max(bottomRight.x - topLeft.x, 1),
        height: Math.max(bottomRight.y - topLeft.y, 1),
      };
    };

    const collectLinks = (el: SVGGraphicsElement): AttachedLink[] => {
      const tag = el.tagName.toLowerCase();
      if (tag === "text" || tag === "line" || tag === "polyline") return [];
      const box = bboxOf(el);
      const M = 8;
      const near = (x: number, y: number) =>
        x >= box.x - M && x <= box.x + box.width + M &&
        y >= box.y - M && y <= box.y + box.height + M;
      const links: AttachedLink[] = [];

      svgEl.querySelectorAll<SVGGraphicsElement>("text,line,polyline,path").forEach(
        (other) => {
          if (other === el || other === handleRef.current) return;
          if (selRef.current.includes(other)) return; // 组内元素自己动
          const otag = other.tagName.toLowerCase();

          if (otag === "text") {
            const x = parseFloat(other.getAttribute("x") ?? "");
            const y = parseFloat(other.getAttribute("y") ?? "");
            if (!Number.isNaN(x) && !Number.isNaN(y) && near(x, y)) {
              links.push({ el: other, kind: "whole", orig: snapshotAttrs(other) });
            }
            return;
          }
          if (otag === "line") {
            const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((a) =>
              parseFloat(other.getAttribute(a) ?? ""),
            );
            if ([x1, y1, x2, y2].some(Number.isNaN)) return;
            if (near(x1, y1)) links.push({ el: other, kind: "start", orig: snapshotAttrs(other) });
            if (near(x2, y2)) links.push({ el: other, kind: "end", orig: snapshotAttrs(other) });
            return;
          }
          if (otag === "polyline") {
            const raw = other.getAttribute("points") ?? "";
            const nums = raw.trim().split(/[\s,]+/).map(Number);
            if (nums.length >= 4 && !nums.some(Number.isNaN)) {
              if (near(nums[0], nums[1])) links.push({ el: other, kind: "start", orig: {}, origPoints: raw });
              if (near(nums[nums.length - 2], nums[nums.length - 1]))
                links.push({ el: other, kind: "end", orig: {}, origPoints: raw });
            }
            return;
          }
          if (otag === "path") {
            const d = other.getAttribute("d") ?? "";
            const m = d.match(/^\s*M\s*([\d.eE+-]+)[\s,]+([\d.eE+-]+)\s*L\s*([\d.eE+-]+)[\s,]+([\d.eE+-]+)\s*$/i);
            if (!m) return;
            if (near(+m[1], +m[2])) links.push({ el: other, kind: "start", orig: {}, origD: d });
            if (near(+m[3], +m[4])) links.push({ el: other, kind: "end", orig: {}, origD: d });
          }
        },
      );
      return links;
    };

    const applyLinks = (links: AttachedLink[], dx: number, dy: number) => {
      for (const link of links) {
        const el = link.el;
        const tag = el.tagName.toLowerCase();
        if (tag === "text") {
          el.setAttribute("x", String((link.orig.x ?? 0) + dx));
          el.setAttribute("y", String((link.orig.y ?? 0) + dy));
        } else if (tag === "line") {
          if (link.kind === "start") {
            el.setAttribute("x1", String((link.orig.x1 ?? 0) + dx));
            el.setAttribute("y1", String((link.orig.y1 ?? 0) + dy));
          } else {
            el.setAttribute("x2", String((link.orig.x2 ?? 0) + dx));
            el.setAttribute("y2", String((link.orig.y2 ?? 0) + dy));
          }
        } else if (tag === "polyline" && link.origPoints) {
          const nums = link.origPoints.trim().split(/[\s,]+/).map(Number);
          if (link.kind === "start") {
            nums[0] += dx;
            nums[1] += dy;
          } else {
            nums[nums.length - 2] += dx;
            nums[nums.length - 1] += dy;
          }
          el.setAttribute("points", nums.join(" "));
        } else if (tag === "path" && link.origD) {
          const m = link.origD.match(/^\s*M\s*([\d.eE+-]+)[\s,]+([\d.eE+-]+)\s*L\s*([\d.eE+-]+)[\s,]+([\d.eE+-]+)\s*$/i);
          if (!m) continue;
          const [x1, y1, x2, y2] = [+m[1], +m[2], +m[3], +m[4]];
          if (link.kind === "start") {
            el.setAttribute("d", `M ${x1 + dx} ${y1 + dy} L ${x2} ${y2}`);
          } else {
            el.setAttribute("d", `M ${x1} ${y1} L ${x2 + dx} ${y2 + dy}`);
          }
        }
      }
    };

    const applyMove = (
      el: SVGGraphicsElement,
      orig: Record<string, number>,
      origTransform: string,
      dx: number,
      dy: number,
    ) => {
      const tag = el.tagName.toLowerCase();
      if (["rect", "image", "text"].includes(tag)) {
        if (orig.x !== undefined) el.setAttribute("x", String(orig.x + dx));
        if (orig.y !== undefined) el.setAttribute("y", String(orig.y + dy));
      } else if (["circle", "ellipse"].includes(tag)) {
        if (orig.cx !== undefined) el.setAttribute("cx", String(orig.cx + dx));
        if (orig.cy !== undefined) el.setAttribute("cy", String(orig.cy + dy));
      } else if (tag === "line") {
        el.setAttribute("x1", String((orig.x1 ?? 0) + dx));
        el.setAttribute("x2", String((orig.x2 ?? 0) + dx));
        el.setAttribute("y1", String((orig.y1 ?? 0) + dy));
        el.setAttribute("y2", String((orig.y2 ?? 0) + dy));
      } else {
        el.setAttribute("transform", `translate(${dx} ${dy}) ${origTransform}`.trim());
      }
    };

    const ensureArrowMarker = (): string => {
      let defs = svgEl.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS(NS, "defs");
        svgEl.prepend(defs);
      }
      let marker = svgEl.querySelector<SVGMarkerElement>("marker#vl-arrow");
      if (!marker) {
        marker = document.createElementNS(NS, "marker");
        marker.setAttribute("id", "vl-arrow");
        marker.setAttribute("markerWidth", "10");
        marker.setAttribute("markerHeight", "10");
        marker.setAttribute("refX", "8");
        marker.setAttribute("refY", "3");
        marker.setAttribute("orient", "auto");
        const arrowPath = document.createElementNS(NS, "path");
        arrowPath.setAttribute("d", "M0,0 L8,3 L0,6 Z");
        arrowPath.setAttribute("fill", "#6366f1");
        marker.appendChild(arrowPath);
        defs.appendChild(marker);
      }
      return "url(#vl-arrow)";
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;

      // 缩放手柄
      if (target === handleRef.current && selRef.current.length === 1) {
        const el = selRef.current[0];
        dragRef.current = {
          mode: "resize",
          el,
          startX: e.clientX,
          startY: e.clientY,
          origMap: new Map([[el, snapshotAttrs(el)]]),
          transformMap: new Map([[el, el.getAttribute("transform") ?? ""]]),
          bbox: bboxOf(el),
          links: [],
          beforeSnapshot: serializeNow(),
        };
        e.preventDefault();
        return;
      }

      // 连接点 → 连线模式
      const connIdx = connPointsRef.current.indexOf(target as SVGCircleElement);
      if (connIdx >= 0 && selRef.current.length === 1) {
        const source = selRef.current[0];
        // 起点:从源中心朝连接点方向,经边界相交精确落到源边缘
        const sBox = shapeBoxOf(source, screenToSvg);
        const sKind = shapeKindOf(source) ?? "rect";
        const sideTargets = sBox
          ? [
              { x: sBox.cx, y: sBox.cy - sBox.hh * 2 }, // 上方向
              { x: sBox.cx + sBox.hw * 2, y: sBox.cy }, // 右
              { x: sBox.cx, y: sBox.cy + sBox.hh * 2 }, // 下
              { x: sBox.cx - sBox.hw * 2, y: sBox.cy }, // 左
            ]
          : [];
        const start = sBox
          ? shapeIntersection(sKind, sBox, sideTargets[connIdx])
          : screenToSvg(e.clientX, e.clientY);
        const temp = document.createElementNS(NS, "line") as SVGLineElement;
        temp.setAttribute("x1", String(start.x));
        temp.setAttribute("y1", String(start.y));
        temp.setAttribute("x2", String(start.x));
        temp.setAttribute("y2", String(start.y));
        temp.setAttribute("stroke", "#6366f1");
        temp.setAttribute("stroke-width", "2");
        temp.setAttribute("stroke-dasharray", "4 3");
        temp.setAttribute("class", "vl-temp-line");
        svgEl.appendChild(temp);
        dragRef.current = {
          mode: "connect",
          el: source,
          startX: e.clientX,
          startY: e.clientY,
          origMap: new Map(),
          transformMap: new Map(),
          bbox: { x: 0, y: 0, width: 0, height: 0 },
          links: [],
          tempLine: temp,
          startPoint: start,
          startSide: connIdx,
          beforeSnapshot: serializeNow(),
        };
        e.preventDefault();
        return;
      }

      const el = target.closest(SHAPE_SELECTOR) as SVGGraphicsElement | null;

      // ⌘点击:多选切换
      if ((e.metaKey || e.ctrlKey) && el && el !== svgEl) {
        const current = selRef.current;
        select(
          current.includes(el)
            ? current.filter((x) => x !== el)
            : [...current, el],
        );
        e.preventDefault();
        return;
      }

      // 空白处 → 框选
      if (!el || el === svgEl) {
        const rect = host.getBoundingClientRect();
        const marquee = document.createElement("div");
        marquee.className = "vl-marquee";
        marquee.style.left = `${e.clientX - rect.left}px`;
        marquee.style.top = `${e.clientY - rect.top}px`;
        host.appendChild(marquee);
        marqueeRef.current = marquee;
        dragRef.current = {
          mode: "marquee",
          el: null,
          startX: e.clientX,
          startY: e.clientY,
          origMap: new Map(),
          transformMap: new Map(),
          bbox: { x: 0, y: 0, width: 0, height: 0 },
          links: [],
        };
        e.preventDefault();
        return;
      }

      // 普通点选/拖拽(组内元素则整组移动)
      const current = selRef.current;
      const group = current.includes(el) && current.length > 1 ? current : [el];
      select(group);

      const origMap = new Map<SVGGraphicsElement, Record<string, number>>();
      const transformMap = new Map<SVGGraphicsElement, string>();
      const links: AttachedLink[] = [];
      for (const member of group) {
        origMap.set(member, snapshotAttrs(member));
        transformMap.set(member, member.getAttribute("transform") ?? "");
        links.push(...collectLinks(member));
      }
      dragRef.current = {
        mode: "move",
        el,
        startX: e.clientX,
        startY: e.clientY,
        origMap,
        transformMap,
        bbox: group.length === 1 ? bboxOf(el) : { x: 0, y: 0, width: 0, height: 0 },
        links,
        beforeSnapshot: serializeNow(),
      };
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.mode === "marquee") {
        const marquee = marqueeRef.current;
        if (!marquee) return;
        const rect = host.getBoundingClientRect();
        marquee.style.left = `${Math.min(e.clientX, drag.startX) - rect.left}px`;
        marquee.style.top = `${Math.min(e.clientY, drag.startY) - rect.top}px`;
        marquee.style.width = `${Math.abs(e.clientX - drag.startX)}px`;
        marquee.style.height = `${Math.abs(e.clientY - drag.startY)}px`;
        return;
      }

      if (drag.mode === "connect") {
        const point = screenToSvg(e.clientX, e.clientY);
        drag.tempLine?.setAttribute("x2", String(point.x));
        drag.tempLine?.setAttribute("y2", String(point.y));
        return;
      }

      const { dx, dy } = svgDelta(e.clientX - drag.startX, e.clientY - drag.startY);
      const el = drag.el!;
      const tag = el.tagName.toLowerCase();

      if (drag.mode === "move") {
        let adx = dx;
        let ady = dy;
        // 单选:对齐参考线吸附 → 网格吸附
        if (selRef.current.length === 1) {
          const box = drag.bbox.width > 0 ? drag.bbox : bboxOf(el);
          const others: SVGGraphicsElement[] = [];
          svgEl.querySelectorAll<SVGGraphicsElement>(SHAPE_SELECTOR).forEach((o) => {
            if (o !== el && o !== handleRef.current && !connPointsRef.current.includes(o as SVGCircleElement)) others.push(o);
          });
          const xs: number[] = [];
          const ys: number[] = [];
          for (const o of others) {
            const b = bboxOf(o);
            xs.push(b.x, b.x + b.width / 2, b.x + b.width);
            ys.push(b.y, b.y + b.height / 2, b.y + b.height);
          }
          const edgesX = [box.x, box.x + box.width / 2, box.x + box.width];
          const edgesY = [box.y, box.y + box.height / 2, box.y + box.height];
          const TH = 3;
          let bestX: { d: number; at: number } | null = null;
          let bestY: { d: number; at: number } | null = null;
          for (const ex of edgesX) {
            for (const cx of xs) {
              const diff = cx - (ex + dx);
              if (Math.abs(diff) < TH && (!bestX || Math.abs(diff) < Math.abs(bestX.d))) {
                bestX = { d: diff, at: cx };
              }
            }
          }
          for (const ey of edgesY) {
            for (const cy of ys) {
              const diff = cy - (ey + dy);
              if (Math.abs(diff) < TH && (!bestY || Math.abs(diff) < Math.abs(bestY.d))) {
                bestY = { d: diff, at: cy };
              }
            }
          }
          if (bestX) adx += bestX.d;
          if (bestY) ady += bestY.d;
          showGuides({ v: bestX?.at, h: bestY?.at });
          if (!bestX && !bestY) hideGuides();

          // 网格吸附(未吸附参考线时)
          if (snapRef.current && !bestX && !bestY) {
            const G = 16;
            adx = Math.round((box.x + dx) / G) * G - box.x;
            ady = Math.round((box.y + dy) / G) * G - box.y;
          }
        }
        for (const [member, orig] of drag.origMap) {
          applyMove(member, orig, drag.transformMap.get(member) ?? "", adx, ady);
        }
        applyLinks(drag.links, adx, ady);
        if (selRef.current.length === 1) positionEditorUI(el);
        return;
      }

      // resize
      const orig = drag.origMap.get(el) ?? {};
      if (tag === "rect" || tag === "image") {
        el.setAttribute("width", String(Math.max(4, (orig.width ?? 0) + dx)));
        el.setAttribute("height", String(Math.max(4, (orig.height ?? 0) + dy)));
      } else if (tag === "circle") {
        el.setAttribute("r", String(Math.max(2, (orig.r ?? 0) + dx)));
      } else if (tag === "ellipse") {
        el.setAttribute("rx", String(Math.max(2, (orig.rx ?? 0) + dx)));
        el.setAttribute("ry", String(Math.max(2, (orig.ry ?? 0) + dy)));
      } else if (tag === "line") {
        el.setAttribute("x2", String((orig.x2 ?? 0) + dx));
        el.setAttribute("y2", String((orig.y2 ?? 0) + dy));
      } else if (tag === "text") {
        const ratio = (drag.bbox.width + dx) / drag.bbox.width;
        const origSize = orig["font-size"] ?? 14;
        el.setAttribute("font-size", String(Math.max(6, Math.round(origSize * ratio))));
      } else {
        const s = Math.max(0.05, (drag.bbox.width + dx) / drag.bbox.width);
        const { x, y } = drag.bbox;
        el.setAttribute(
          "transform",
          `translate(${x} ${y}) scale(${s}) translate(${-x} ${-y}) ${drag.transformMap.get(el) ?? ""}`.trim(),
        );
      }
      positionEditorUI(el);
    };

    const onMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;

      if (drag.mode === "marquee") {
        const marquee = marqueeRef.current;
        if (marquee) {
          const box = marquee.getBoundingClientRect();
          marquee.remove();
          marqueeRef.current = null;
          if (box.width > 4 && box.height > 4) {
            const hits: SVGGraphicsElement[] = [];
            svgEl
              .querySelectorAll<SVGGraphicsElement>(SHAPE_SELECTOR)
              .forEach((el) => {
                if (
                  el === handleRef.current ||
                  connPointsRef.current.includes(el as SVGCircleElement)
                )
                  return;
                const r = el.getBoundingClientRect();
                if (
                  r.left < box.right && r.right > box.left &&
                  r.top < box.bottom && r.bottom > box.top
                ) {
                  hits.push(el);
                }
              });
            select(hits);
          } else {
            select([]);
          }
        }
        return;
      }

      if (drag.mode === "connect") {
        const temp = drag.tempLine;
        if (temp) {
          const targetEl = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest(SHAPE_SELECTOR) as SVGGraphicsElement | null;
          let end = screenToSvg(e.clientX, e.clientY);
          if (targetEl && targetEl !== drag.el && targetEl !== svgRef.current) {
            // 磁吸:从目标中心射向鼠标点,经边界相交精确落到目标边缘
            const tBox = shapeBoxOf(targetEl, screenToSvg);
            const tKind = shapeKindOf(targetEl) ?? "rect";
            if (tBox) {
              end = shapeIntersection(tKind, tBox, end);
            }
          }
          const dist = drag.startPoint
            ? Math.hypot(end.x - drag.startPoint.x, end.y - drag.startPoint.y)
            : 0;
          if (dist > 8 && drag.startPoint && drag.el) {
            const s = drag.startPoint;
            const pts = orthoRoute(s, end, drag.startSide);
            const poly = document.createElementNS(NS, "polyline");
            poly.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
            poly.setAttribute("fill", "none");
            poly.setAttribute("stroke", "#6366f1");
            poly.setAttribute("stroke-width", "2");
            poly.setAttribute("marker-end", ensureArrowMarker());
            // 会话内锚定(D2):用元素引用记录两端 + 起 side,拖节点时重算。
            // data-vl-anchor 只作"这条线有锚定"的标记,存盘时被序列化剥离。
            poly.setAttribute("data-vl-anchor", "1");
            const ref = poly as SVGPolylineElement & {
              __vlStart?: SVGGraphicsElement;
              __vlEnd?: SVGGraphicsElement | null;
              __vlStartSide?: number;
            };
            ref.__vlStart = drag.el;
            ref.__vlEnd = targetEl;
            ref.__vlStartSide = drag.startSide;
            temp.replaceWith(poly);
            if (drag.beforeSnapshot) pushHistory(drag.beforeSnapshot);
          } else {
            temp.remove();
          }
        }
        return;
      }

      hideGuides();
      // move 结束:重算锚定到被移动元素的连线(会话内磁吸跟随)
      for (const [member] of drag.origMap) {
        rerouteAnchoredLines(member, screenToSvg);
      }
      // move / resize:有变化则入栈
      if (drag.beforeSnapshot && serializeNow() !== drag.beforeSnapshot) {
        pushHistory(drag.beforeSnapshot);
      }
    };

    host.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      host.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [open, select, hostEl, svgDelta, screenToSvg, positionEditorUI, serializeNow, pushHistory]);

  // 键盘:Delete / ⌘Z / ⇧⌘Z / 方向键微调 / ⌘C⌘V 复制粘贴
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      // 复制:存 outerHTML
      if (mod && e.key.toLowerCase() === "c" && selRef.current.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        clipboardRef.current = selRef.current.map((el) => {
          const clone = el.cloneNode(true) as SVGGraphicsElement;
          clone.removeAttribute("data-vl-sel");
          return clone.outerHTML;
        });
        return;
      }

      // 粘贴:偏移 16px 插入
      if (mod && e.key.toLowerCase() === "v" && clipboardRef.current.length > 0) {
        const svgEl = svgRef.current;
        if (!svgEl) return;
        e.preventDefault();
        e.stopPropagation();
        pushHistory(serializeNow());
        const pasted: SVGGraphicsElement[] = [];
        for (const html of clipboardRef.current) {
          const wrap = document.createElementNS(NS, "g");
          wrap.innerHTML = html;
          const child = wrap.firstElementChild as SVGGraphicsElement | null;
          if (!child) continue;
          const prev = child.getAttribute("transform") ?? "";
          child.setAttribute("transform", `translate(16 16) ${prev}`.trim());
          svgEl.appendChild(child);
          pasted.push(child);
        }
        if (handleRef.current) svgEl.appendChild(handleRef.current);
        connPointsRef.current.forEach((c) => svgEl.appendChild(c));
        select(pasted);
        return;
      }

      // 方向键微调(1 单位,Shift = 8;800ms 内连续微调合并为一条历史)
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (arrows[e.key] && selRef.current.length > 0) {
        e.preventDefault();
        const [ax, ay] = arrows[e.key];
        const step = e.shiftKey ? 8 : 1;
        const now = Date.now();
        if (now - lastNudgeRef.current > 800) {
          pushHistory(serializeNow());
        }
        lastNudgeRef.current = now;
        for (const el of selRef.current) {
          const orig: Record<string, number> = {};
          for (const attr of ["x", "y", "cx", "cy", "x1", "y1", "x2", "y2"]) {
            const v = parseFloat(el.getAttribute(attr) ?? "");
            if (!Number.isNaN(v)) orig[attr] = v;
          }
          const tag = el.tagName.toLowerCase();
          if (["rect", "image", "text"].includes(tag)) {
            if (orig.x !== undefined) el.setAttribute("x", String(orig.x + ax * step));
            if (orig.y !== undefined) el.setAttribute("y", String(orig.y + ay * step));
          } else if (["circle", "ellipse"].includes(tag)) {
            if (orig.cx !== undefined) el.setAttribute("cx", String(orig.cx + ax * step));
            if (orig.cy !== undefined) el.setAttribute("cy", String(orig.cy + ay * step));
          } else if (tag === "line") {
            for (const a of ["x1", "x2"]) el.setAttribute(a, String((orig[a] ?? 0) + ax * step));
            for (const a of ["y1", "y2"]) el.setAttribute(a, String((orig[a] ?? 0) + ay * step));
          } else {
            const prev = el.getAttribute("transform") ?? "";
            el.setAttribute("transform", `translate(${ax * step} ${ay * step}) ${prev}`.trim());
          }
        }
        if (selRef.current.length === 1) positionEditorUI(selRef.current[0]);
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selRef.current.length > 0) {
        pushHistory(serializeNow());
        selRef.current.forEach((el) => el.remove());
        select([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, select, undo, redo, pushHistory, serializeNow, positionEditorUI]);

  // 双击 text 元素:就地编辑
  useEffect(() => {
    const host = hostEl;
    if (!open || !host) return;
    const onDblClick = (e: MouseEvent) => {
      const target = (e.target as Element).closest("text") as SVGTextElement | null;
      if (!target) return;
      e.preventDefault();
      setTextEdit({ el: target, x: e.clientX, y: e.clientY, value: target.textContent ?? "" });
    };
    host.addEventListener("dblclick", onDblClick);
    return () => host.removeEventListener("dblclick", onDblClick);
  }, [open, hostEl]);

  // ── 添加元素 ──────────────────────────────────────────
  const addElement = (kind: "rect" | "circle" | "text" | "arrow" | "diamond") => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    pushHistory(serializeNow());
    const vb = svgEl.viewBox.baseVal;
    const cx = (vb.width || 400) / 2;
    const cy = (vb.height || 300) / 2;

    let el: SVGGraphicsElement;
    if (kind === "rect") {
      el = document.createElementNS(NS, "rect") as SVGGraphicsElement;
      el.setAttribute("x", String(cx - 60));
      el.setAttribute("y", String(cy - 24));
      el.setAttribute("width", "120");
      el.setAttribute("height", "48");
      el.setAttribute("rx", "6");
      el.setAttribute("fill", "#eef2ff");
      el.setAttribute("stroke", "#6366f1");
    } else if (kind === "circle") {
      el = document.createElementNS(NS, "circle") as SVGGraphicsElement;
      el.setAttribute("cx", String(cx));
      el.setAttribute("cy", String(cy));
      el.setAttribute("r", "28");
      el.setAttribute("fill", "#eef2ff");
      el.setAttribute("stroke", "#6366f1");
    } else if (kind === "diamond") {
      el = document.createElementNS(NS, "polygon") as SVGGraphicsElement;
      // 菱形四顶点(中心 ± 半宽/半高)
      const pts = [
        [cx, cy - 28],
        [cx + 70, cy],
        [cx, cy + 28],
        [cx - 70, cy],
      ];
      el.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
      el.setAttribute("data-vl-shape", "diamond");
      el.setAttribute("fill", "#fff7ed");
      el.setAttribute("stroke", "#d97706");
    } else if (kind === "text") {
      el = document.createElementNS(NS, "text") as SVGGraphicsElement;
      el.setAttribute("x", String(cx));
      el.setAttribute("y", String(cy));
      el.setAttribute("font-size", "14");
      el.setAttribute("fill", "#18181b");
      el.textContent = "双击右侧编辑文字";
    } else {
      el = document.createElementNS(NS, "line") as SVGGraphicsElement;
      el.setAttribute("x1", String(cx - 60));
      el.setAttribute("y1", String(cy));
      el.setAttribute("x2", String(cx + 60));
      el.setAttribute("y2", String(cy));
      el.setAttribute("stroke", "#6366f1");
      el.setAttribute("stroke-width", "2");
      svgEl.appendChild(el);
      el.setAttribute("marker-end", (() => {
        let defs = svgEl.querySelector("defs");
        if (!defs) {
          defs = document.createElementNS(NS, "defs");
          svgEl.prepend(defs);
        }
        let marker = svgEl.querySelector("marker#vl-arrow");
        if (!marker) {
          marker = document.createElementNS(NS, "marker");
          marker.setAttribute("id", "vl-arrow");
          marker.setAttribute("markerWidth", "10");
          marker.setAttribute("markerHeight", "10");
          marker.setAttribute("refX", "8");
          marker.setAttribute("refY", "3");
          marker.setAttribute("orient", "auto");
          const p = document.createElementNS(NS, "path");
          p.setAttribute("d", "M0,0 L8,3 L0,6 Z");
          p.setAttribute("fill", "#6366f1");
          marker.appendChild(p);
          defs.appendChild(marker);
        }
        return "url(#vl-arrow)";
      })());
      svgEl.appendChild(el);
      select([el]);
      return;
    }
    svgEl.appendChild(el);
    // 编辑器 UI 保持在最上层
    if (handleRef.current) svgEl.appendChild(handleRef.current);
    connPointsRef.current.forEach((c) => svgEl.appendChild(c));
    select([el]);
  };

  // ── 属性面板修改 ──────────────────────────────────────
  const applyAttr = (attr: string, value: string) => {
    const el = selRef.current[0];
    if (!el) return;
    pushHistory(serializeNow());
    if (value === "") el.removeAttribute(attr);
    else el.setAttribute(attr, value);
    readInfo(el);
    positionEditorUI(el);
  };

  /** 组对齐/分布:以各元素包围盒为准 */
  const alignSelection = (mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom" | "distributeX" | "distributeY") => {
    const els = selRef.current;
    if (els.length < 2) return;
    pushHistory(serializeNow());

    const boxOf = (el: SVGGraphicsElement) => {
      const r = el.getBoundingClientRect();
      const tl = screenToSvg(r.left, r.top);
      const br = screenToSvg(r.right, r.bottom);
      return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y, el };
    };
    const translateBy = (el: SVGGraphicsElement, dx: number, dy: number) => {
      const orig: Record<string, number> = {};
      for (const attr of ["x", "y", "cx", "cy", "x1", "y1", "x2", "y2"]) {
        const v = parseFloat(el.getAttribute(attr) ?? "");
        if (!Number.isNaN(v)) orig[attr] = v;
      }
      const tag = el.tagName.toLowerCase();
      if (["rect", "image", "text"].includes(tag)) {
        if (orig.x !== undefined) el.setAttribute("x", String(orig.x + dx));
        if (orig.y !== undefined) el.setAttribute("y", String(orig.y + dy));
      } else if (["circle", "ellipse"].includes(tag)) {
        if (orig.cx !== undefined) el.setAttribute("cx", String(orig.cx + dx));
        if (orig.cy !== undefined) el.setAttribute("cy", String(orig.cy + dy));
      } else if (tag === "line") {
        for (const a of ["x1", "x2"]) el.setAttribute(a, String((orig[a] ?? 0) + dx));
        for (const a of ["y1", "y2"]) el.setAttribute(a, String((orig[a] ?? 0) + dy));
      } else {
        const prev = el.getAttribute("transform") ?? "";
        el.setAttribute("transform", `translate(${dx} ${dy}) ${prev}`.trim());
      }
    };

    const items = els.map(boxOf);
    if (mode === "distributeX" || mode === "distributeY") {
      if (items.length < 3) return;
      const horizontal = mode === "distributeX";
      items.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
      const first = items[0];
      const last = items[items.length - 1];
      const span = horizontal ? last.x - first.x : last.y - first.y;
      const step = span / (items.length - 1);
      items.forEach((item, i) => {
        const target = (horizontal ? first.x : first.y) + step * i;
        const d = target - (horizontal ? item.x : item.y);
        translateBy(item.el, horizontal ? d : 0, horizontal ? 0 : d);
      });
      return;
    }

    const xs = items.map((b) => b.x);
    const ys = items.map((b) => b.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...items.map((b) => b.x + b.w));
    const midX = (minX + maxX) / 2;
    const minY = Math.min(...ys);
    const maxY = Math.max(...items.map((b) => b.y + b.h));
    const midY = (minY + maxY) / 2;

    for (const b of items) {
      let dx = 0;
      let dy = 0;
      if (mode === "left") dx = minX - b.x;
      if (mode === "right") dx = maxX - (b.x + b.w);
      if (mode === "centerX") dx = midX - (b.x + b.w / 2);
      if (mode === "top") dy = minY - b.y;
      if (mode === "bottom") dy = maxY - (b.y + b.h);
      if (mode === "centerY") dy = midY - (b.y + b.h / 2);
      translateBy(b.el, dx, dy);
    }
  };

  /** 层级:置于顶层/底层 */
  const reorderSelection = (where: "front" | "back") => {
    const svgEl = svgRef.current;
    if (!svgEl || selRef.current.length === 0) return;
    pushHistory(serializeNow());
    for (const el of selRef.current) {
      if (where === "front") {
        svgEl.appendChild(el);
      } else {
        const defs = svgEl.querySelector("defs");
        svgEl.insertBefore(el, defs ? defs.nextSibling : svgEl.firstChild);
      }
    }
    if (handleRef.current) svgEl.appendChild(handleRef.current);
    connPointsRef.current.forEach((c) => svgEl.appendChild(c));
  };

  /** 连线转直角折线 */
  const elbowLine = () => {
    const el = selRef.current[0];
    const svgEl = svgRef.current;
    if (!el || !svgEl || el.tagName.toLowerCase() !== "line") return;
    pushHistory(serializeNow());
    const x1 = parseFloat(el.getAttribute("x1") ?? "0");
    const y1 = parseFloat(el.getAttribute("y1") ?? "0");
    const x2 = parseFloat(el.getAttribute("x2") ?? "0");
    const y2 = parseFloat(el.getAttribute("y2") ?? "0");
    const poly = document.createElementNS(NS, "polyline") as SVGGraphicsElement;
    poly.setAttribute("points", `${x1},${y1} ${x2},${y1} ${x2},${y2}`);
    poly.setAttribute("fill", "none");
    for (const attr of ["stroke", "stroke-width", "stroke-dasharray", "marker-end"]) {
      const v = el.getAttribute(attr);
      if (v) poly.setAttribute(attr, v);
    }
    el.replaceWith(poly);
    select([poly]);
  };

  const deleteSelection = () => {
    if (selRef.current.length === 0) return;
    pushHistory(serializeNow());
    selRef.current.forEach((el) => el.remove());
    select([]);
  };

  const save = async () => {
    const next = serializeNow();
    if (!next) return;
    await onSave(next);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="vl-dialog-overlay" />
        <Dialog.Content
          className="vl-dialog"
          style={{
            width: 900,
            maxWidth: "94vw",
            height: 640,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold">
              SVG 画布编辑
            </Dialog.Title>
            <div className="flex items-center gap-1">
              <ToolButton onClick={undo} title="撤销 (⌘Z)">
                <Undo2 size={14} />
              </ToolButton>
              <ToolButton onClick={redo} title="重做 (⇧⌘Z)">
                <Redo2 size={14} />
              </ToolButton>
              <span className="mx-1 h-4 w-px" style={{ background: "var(--vl-border)" }} />
              <ToolButton onClick={() => addElement("rect")} title="添加矩形">
                <Square size={14} />
              </ToolButton>
              <ToolButton onClick={() => addElement("circle")} title="添加圆形">
                <Circle size={14} />
              </ToolButton>
              <ToolButton onClick={() => addElement("diamond")} title="添加菱形(判断)">
                <Diamond size={14} />
              </ToolButton>
              <ToolButton onClick={() => addElement("text")} title="添加文字">
                <Type size={14} />
              </ToolButton>
              <ToolButton onClick={() => addElement("arrow")} title="添加箭头">
                <MoveRight size={14} />
              </ToolButton>
              <span className="mx-1 h-4 w-px" style={{ background: "var(--vl-border)" }} />
              <ToolButton onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} title="缩小">
                <ZoomOut size={14} />
              </ToolButton>
              <span className="w-10 text-center text-xs" style={{ color: "var(--vl-text-muted)" }}>
                {Math.round(zoom * 100)}%
              </span>
              <ToolButton onClick={() => setZoom((z) => Math.min(4, z + 0.25))} title="放大">
                <ZoomIn size={14} />
              </ToolButton>
              <ToolButton
                onClick={() => {
                  const svgEl = svgRef.current;
                  if (!svgEl || !hostEl) return;
                  const bb = svgEl.getBBox();
                  if (bb.width < 1 || bb.height < 1) return;
                  const hr = hostEl.getBoundingClientRect();
                  const z = Math.min((hr.width - 60) / bb.width, (hr.height - 60) / bb.height);
                  setZoom(Math.min(4, Math.max(0.25, z)));
                }}
                title="适应画布"
              >
                <Maximize size={14} />
              </ToolButton>
              <span className="mx-1 h-4 w-px" style={{ background: "var(--vl-border)" }} />
              <ToolButton onClick={() => setShowGrid((v) => !v)} title={showGrid ? "隐藏网格" : "显示网格"}>
                <Grid3x3 size={14} color={showGrid ? "var(--vl-accent)" : undefined} />
              </ToolButton>
              <ToolButton onClick={() => setSnapEnabled((v) => !v)} title={snapEnabled ? "关闭吸附" : "网格吸附"}>
                <Magnet size={14} color={snapEnabled ? "var(--vl-accent)" : undefined} />
              </ToolButton>
              <Dialog.Close className="vl-dialog-close">
                <X size={14} />
              </Dialog.Close>
            </div>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 gap-3">
            <div className="vl-canvas-host" ref={setHostEl} />

            <div
              className="flex w-44 shrink-0 flex-col gap-2 overflow-y-auto border-l pl-3 text-xs"
              style={{ borderColor: "var(--vl-border)" }}
            >
              {info && single ? (
                <>
                  <div className="font-medium" style={{ color: "var(--vl-text-muted)" }}>
                    {info.tag} 属性
                  </div>
                  <ColorField label="填充" value={info.fill} onChange={(v) => applyAttr("fill", v)} />
                  <ColorField label="描边" value={info.stroke} onChange={(v) => applyAttr("stroke", v)} />
                  <TextField label="描边宽" value={info.strokeWidth} onChange={(v) => applyAttr("stroke-width", v)} />
                  {info.tag === "text" && (
                    <>
                      <TextField label="文字" value={info.text} onChange={(v) => { single.textContent = v; readInfo(single); }} />
                      <TextField label="字号" value={info.fontSize} onChange={(v) => applyAttr("font-size", v)} />
                    </>
                  )}
                  {(info.tag === "line" || info.tag === "polyline") && (
                    <>
                      <label className="flex items-center justify-between gap-2">
                        <span style={{ color: "var(--vl-text-muted)" }}>虚线</span>
                        <input
                          type="checkbox"
                          checked={!!single.getAttribute("stroke-dasharray")}
                          onChange={(e) =>
                            applyAttr("stroke-dasharray", e.target.checked ? "6 4" : "")
                          }
                          style={{ accentColor: "var(--vl-accent)" }}
                        />
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="flex-1 rounded border px-1 py-1 text-[11px]"
                          style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
                          onClick={() =>
                            applyAttr(
                              "marker-end",
                              single.getAttribute("marker-end") ? "" : "url(#vl-arrow)",
                            )
                          }
                        >
                          {single.getAttribute("marker-end") ? "去掉箭头" : "加箭头"}
                        </button>
                        {info.tag === "line" && (
                          <button
                            type="button"
                            className="flex-1 rounded border px-1 py-1 text-[11px]"
                            style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
                            title="转为直角折线"
                            onClick={elbowLine}
                          >
                            <Spline size={11} style={{ verticalAlign: -2 }} /> 直角化
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" className="flex items-center justify-center gap-1 rounded border px-1 py-1 text-[11px]" style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }} onClick={() => reorderSelection("front")}>
                      <ArrowUpToLine size={11} /> 置顶
                    </button>
                    <button type="button" className="flex items-center justify-center gap-1 rounded border px-1 py-1 text-[11px]" style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }} onClick={() => reorderSelection("back")}>
                      <ArrowDownToLine size={11} /> 置底
                    </button>
                  </div>
                  <button
                    type="button"
                    className="mt-1 flex items-center justify-center gap-1 rounded-md border px-2 py-1.5"
                    style={{ borderColor: "var(--vl-border)", color: "var(--vl-danger)" }}
                    onClick={deleteSelection}
                  >
                    <Trash2 size={12} />
                    删除元素(或按 Delete)
                  </button>
                </>
              ) : sel.length > 1 ? (
                <>
                  <div className="font-medium" style={{ color: "var(--vl-text-muted)" }}>
                    已选 {sel.length} 个元素
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <ToolButton onClick={() => alignSelection("left")} title="左对齐"><AlignStartVertical size={13} /></ToolButton>
                    <ToolButton onClick={() => alignSelection("centerX")} title="水平居中"><AlignCenterVertical size={13} /></ToolButton>
                    <ToolButton onClick={() => alignSelection("right")} title="右对齐"><AlignEndVertical size={13} /></ToolButton>
                    <ToolButton onClick={() => alignSelection("top")} title="顶对齐"><AlignStartHorizontal size={13} /></ToolButton>
                    <ToolButton onClick={() => alignSelection("centerY")} title="垂直居中"><AlignCenterHorizontal size={13} /></ToolButton>
                    <ToolButton onClick={() => alignSelection("bottom")} title="底对齐"><AlignEndHorizontal size={13} /></ToolButton>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" className="rounded border px-1 py-1 text-[11px]" style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }} onClick={() => alignSelection("distributeX")}>横向等距</button>
                    <button type="button" className="rounded border px-1 py-1 text-[11px]" style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }} onClick={() => alignSelection("distributeY")}>纵向等距</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" className="rounded border px-1 py-1 text-[11px]" style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }} onClick={() => reorderSelection("front")}>置于顶层</button>
                    <button type="button" className="rounded border px-1 py-1 text-[11px]" style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }} onClick={() => reorderSelection("back")}>置于底层</button>
                  </div>
                  <button
                    type="button"
                    className="mt-1 flex items-center justify-center gap-1 rounded-md border px-2 py-1.5"
                    style={{ borderColor: "var(--vl-border)", color: "var(--vl-danger)" }}
                    onClick={deleteSelection}
                  >
                    <Trash2 size={12} />
                    删除所选
                  </button>
                </>
              ) : (
                <div style={{ color: "var(--vl-text-faint)" }}>
                  点击元素选中,拖拽移动;
                  空白处拖出选框框选;
                  从边缘圆点拖出可连线;
                  ⌘Z 撤销 / ⇧⌘Z 重做。
                </div>
              )}
            </div>
          </div>

          {textEdit && (
            <div
              style={{
                position: "fixed",
                left: textEdit.x,
                top: textEdit.y,
                zIndex: 70,
                transform: "translate(-50%, -100%)",
              }}
            >
              <input
                autoFocus
                className="vl-settings-input"
                style={{ minWidth: 140, boxShadow: "var(--vl-shadow)" }}
                value={textEdit.value}
                onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    pushHistory(serializeNow());
                    textEdit.el.textContent = textEdit.value;
                    readInfo(textEdit.el);
                    setTextEdit(null);
                  }
                  if (e.key === "Escape") setTextEdit(null);
                }}
                onBlur={() => {
                  pushHistory(serializeNow());
                  textEdit.el.textContent = textEdit.value;
                  readInfo(textEdit.el);
                  setTextEdit(null);
                }}
              />
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-xs"
                style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
              >
                取消
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--vl-accent)", color: "#fff" }}
              onClick={() => void save()}
            >
              保存修改
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ToolButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      className="rounded-md p-1.5 transition-colors hover:bg-[var(--vl-panel-active)]"
      style={{ color: "var(--vl-text-muted)" }}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

const PRESET_COLORS = [
  "#6366f1", "#818cf8", "#0ea5e9", "#16a34a",
  "#d97706", "#dc2626", "#71717a", "#18181b",
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isColor = /^#[0-9a-fA-F]{3,8}$/.test(value);
  return (
    <div>
      <label className="flex items-center justify-between gap-2">
        <span style={{ color: "var(--vl-text-muted)" }}>{label}</span>
        <span className="flex items-center gap-1">
          <input
            type="color"
            value={isColor ? (value.length === 4 ? expandHex(value) : value.slice(0, 7)) : "#6366f1"}
            onChange={(e) => onChange(e.target.value)}
            className="h-5 w-6 cursor-pointer border-none bg-transparent p-0"
            title="调色盘"
          />
          <input
            className="vl-settings-input"
            style={{ width: 76, padding: "3px 6px" }}
            value={value}
            placeholder="无"
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
      </label>
      <div className="mt-1 flex justify-end gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="h-4 w-4 rounded-sm border"
            style={{
              background: c,
              borderColor: value === c ? "var(--vl-accent)" : "var(--vl-border)",
            }}
            title={c}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span style={{ color: "var(--vl-text-muted)" }}>{label}</span>
      <input
        className="vl-settings-input"
        style={{ width: 96, padding: "3px 6px" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function expandHex(short: string): string {
  return "#" + [...short.slice(1)].map((c) => c + c).join("");
}
