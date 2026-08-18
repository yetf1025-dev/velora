// 画布拖拽/缩放 e2e:真实鼠标操作
import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".vl-svg-canvas svg", { timeout: 10000 });
await page.locator(".vl-svg-canvas").scrollIntoViewIfNeeded();
await page.locator(".vl-svg-canvas").dispatchEvent("mousedown", { button: 0 });
await page.locator("text=画布编辑").dispatchEvent("click");
await page.waitForSelector(".vl-canvas-host svg", { timeout: 5000 });
await page.waitForTimeout(300);

// 真实鼠标点击选中"输入"矩形
// 点矩形左缘(避开覆盖在中央的 text)
const rectPt = await page.evaluate(() => {
  const r = document.querySelector(".vl-canvas-host svg rect").getBoundingClientRect();
  return { x: r.x + 4, y: r.y + 4 };
});
await page.mouse.click(rectPt.x, rectPt.y);
await page.waitForTimeout(200);

// ── 拖拽移动 ──
const before = await page.evaluate(() => {
  const r = document.querySelector(".vl-canvas-host svg rect");
  return { x: +r.getAttribute("x"), y: +r.getAttribute("y") };
});
await page.mouse.move(rectPt.x, rectPt.y);
await page.mouse.down();
await page.mouse.move(rectPt.x + 50, rectPt.y + 30, { steps: 5 });
await page.mouse.up();
const after = await page.evaluate(() => {
  const r = document.querySelector(".vl-canvas-host svg rect");
  return { x: +r.getAttribute("x"), y: +r.getAttribute("y") };
});
console.log("移动:", JSON.stringify(before), "→", JSON.stringify(after),
  Math.abs(after.x - before.x - 50) < 2 && Math.abs(after.y - before.y - 30) < 2 ? "✓ 精确" : "(有偏差)");

// ── 缩放手柄 ──
const handlePt = await page.evaluate(() => {
  const h = document.querySelector(".vl-resize-handle").getBoundingClientRect();
  return { x: h.x + 4, y: h.y + 4 };
});
await page.mouse.move(handlePt.x, handlePt.y);
await page.mouse.down();
await page.mouse.move(handlePt.x + 40, handlePt.y + 20, { steps: 5 });
await page.mouse.up();
const size = await page.evaluate(() => {
  const r = document.querySelector(".vl-canvas-host svg rect");
  return { w: +r.getAttribute("width"), h: +r.getAttribute("height") };
});
console.log("缩放: 90×40 →", `${size.w}×${size.h}`,
  Math.abs(size.w - 130) < 2 && Math.abs(size.h - 60) < 2 ? "✓ 精确" : "✗ 未生效");
await browser.close();
