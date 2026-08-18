/**
 * 边界相交函数:从形状中心出发的射线,求与形状边界的精确交点。
 * 用于磁吸连线的端点精确定位(D2:会话内磁吸,不持久化关系)。
 *
 * 约定:射线从形状中心向某方向(目标点)发射,返回与边界的交点。
 * 形状用其包围盒中心 + 半尺寸描述(屏幕或 SVG 坐标系均可,单位一致即可)。
 */

export interface Box {
  cx: number;
  cy: number;
  /** 半宽 */
  hw: number;
  /** 半高 */
  hh: number;
}

export type ShapeKind = "rect" | "ellipse" | "diamond";

/**
 * 矩形边界相交:射线 (center → point) 与矩形的交点。
 * 矩形 = |dx/hw| 与 |dy/hh| 的较大者为 1 的等高线。
 */
export function rectIntersection(box: Box, target: { x: number; y: number }): { x: number; y: number } {
  const dx = target.x - box.cx;
  const dy = target.y - box.cy;
  if (dx === 0 && dy === 0) return { x: box.cx, y: box.cy };
  const sx = dx / box.hw;
  const sy = dy / box.hh;
  const scale = 1 / Math.max(Math.abs(sx), Math.abs(sy));
  return { x: box.cx + dx * scale, y: box.cy + dy * scale };
}

/**
 * 椭圆边界相交:射线与椭圆 (a=hw, b=hh) 的交点。
 * 参数方程:(cx + a·t·cosθ, cy + b·t·sinθ),t 使其落在椭圆上。
 */
export function ellipseIntersection(box: Box, target: { x: number; y: number }): { x: number; y: number } {
  const dx = target.x - box.cx;
  const dy = target.y - box.cy;
  if (dx === 0 && dy === 0) return { x: box.cx, y: box.cy };
  // 求射线方向上使 (dx·t/hw)² + (dy·t/hh)² = 1 的 t
  const a = (dx / box.hw) ** 2 + (dy / box.hh) ** 2;
  const t = 1 / Math.sqrt(a);
  return { x: box.cx + dx * t, y: box.cy + dy * t };
}

/**
 * 菱形边界相交:菱形 = |dx/hw| + |dy/hh| = 1。
 */
export function diamondIntersection(box: Box, target: { x: number; y: number }): { x: number; y: number } {
  const dx = target.x - box.cx;
  const dy = target.y - box.cy;
  if (dx === 0 && dy === 0) return { x: box.cx, y: box.cy };
  const t = 1 / (Math.abs(dx) / box.hw + Math.abs(dy) / box.hh);
  return { x: box.cx + dx * t, y: box.cy + dy * t };
}

export function shapeIntersection(
  kind: ShapeKind,
  box: Box,
  target: { x: number; y: number },
): { x: number; y: number } {
  switch (kind) {
    case "ellipse":
      return ellipseIntersection(box, target);
    case "diamond":
      return diamondIntersection(box, target);
    case "rect":
    default:
      return rectIntersection(box, target);
  }
}

/** 判断点是否落在形状包围盒内(用于命中检测/容差) */
export function pointInBox(box: Box, p: { x: number; y: number }): boolean {
  return (
    Math.abs(p.x - box.cx) <= box.hw && Math.abs(p.y - box.cy) <= box.hh
  );
}
