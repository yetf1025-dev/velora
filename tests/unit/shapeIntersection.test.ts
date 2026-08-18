import { describe, expect, it } from "vitest";
import {
  diamondIntersection,
  ellipseIntersection,
  rectIntersection,
  shapeIntersection,
} from "../../src/editor/extensions/svg/shapeIntersection";

const box = { cx: 100, cy: 100, hw: 50, hh: 30 };

describe("矩形边界相交", () => {
  it("右方向落在右边中点", () => {
    expect(rectIntersection(box, { x: 300, y: 100 })).toEqual({ x: 150, y: 100 });
  });
  it("斜方向按 max(|sx|,|sy|) 缩放到边", () => {
    // dx=100 dy=30: sx=2, sy=1, scale=0.5 → (150, 115)
    const p = rectIntersection(box, { x: 200, y: 130 });
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(115);
  });
  it("目标在中心返回中心", () => {
    expect(rectIntersection(box, { x: 100, y: 100 })).toEqual({ x: 100, y: 100 });
  });
});

describe("椭圆边界相交", () => {
  it("正右方落在 a 处", () => {
    const p = ellipseIntersection(box, { x: 300, y: 100 });
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(100);
  });
  it("45° 方向落在椭圆上 (dx/a)²+(dy/b)²=1", () => {
    const p = ellipseIntersection(box, { x: 200, y: 130 });
    const norm = ((p.x - 100) / 50) ** 2 + ((p.y - 100) / 30) ** 2;
    expect(norm).toBeCloseTo(1, 5);
  });
});

describe("菱形边界相交", () => {
  it("正右方落在右顶点", () => {
    expect(diamondIntersection(box, { x: 300, y: 100 })).toEqual({ x: 150, y: 100 });
  });
  it("45° 方向满足 |dx/hw|+|dy/hh|=1", () => {
    const p = diamondIntersection(box, { x: 200, y: 130 });
    const sum = Math.abs(p.x - 100) / 50 + Math.abs(p.y - 100) / 30;
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("shapeIntersection 分派", () => {
  it("rect/ellipse/diamond 各走对应函数", () => {
    expect(shapeIntersection("rect", box, { x: 300, y: 100 })).toEqual({ x: 150, y: 100 });
    const e = shapeIntersection("ellipse", box, { x: 200, y: 130 });
    const d = shapeIntersection("diamond", box, { x: 200, y: 130 });
    // 椭圆和菱形在同一方向交点不同
    expect(e).not.toEqual(d);
  });
});
