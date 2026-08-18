// D2 验证:精确磁吸、拖动跟随、菱形相交
import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".vl-svg-canvas svg", { timeout: 10000 });
await page.locator(".vl-svg-canvas").scrollIntoViewIfNeeded();
await page.locator(".vl-svg-canvas").dispatchEvent("mousedown", { button: 0 });
await page.locator("text=画布编辑").dispatchEvent("click");
await page.waitForSelector(".vl-canvas-host svg", { timeout: 5000 });
await page.waitForTimeout(300);

// 选中"输入"矩形,从右连接点拖到"输出"矩形中心
const rectPt = await page.evaluate(() => {
  const r = document.querySelector(".vl-canvas-host svg rect").getBoundingClientRect();
  return { x: r.x + 4, y: r.y + 4 };
});
await page.mouse.click(rectPt.x, rectPt.y);
await page.waitForTimeout(150);

const connPt = await page.evaluate(() => {
  const c = [...document.querySelectorAll(".vl-conn-point")][1].getBoundingClientRect();
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
});
const targetPt = await page.evaluate(() => {
  const rects = [...document.querySelectorAll(".vl-canvas-host svg rect")].filter(r => !r.classList.contains("vl-resize-handle"));
  const r = rects[1].getBoundingClientRect();
  return { x: r.x + 2, y: r.y + r.height / 2 }; // 瞄准左边缘
});
await page.mouse.move(connPt.x, connPt.y);
await page.mouse.down();
await page.mouse.move(targetPt.x, targetPt.y, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(200);

// 检查:连线终点应磁吸到"输出"矩形左边缘(x ≈ 154),而非中心(x ≈ 199)
const endX = await page.evaluate(() => {
  const poly = document.querySelector(".vl-canvas-host svg polyline[data-vl-anchor]");
  if (!poly) return null;
  const pts = poly.getAttribute("points").split(" ");
  const [x, y] = pts[pts.length - 1].split(",").map(Number);
  return { x, y };
});
console.log("连线终点:", JSON.stringify(endX), "目标左边缘≈154:", endX && Math.abs(endX.x - 154) < 3 ? "✓ 精确磁吸" : "✗");

// 2. 拖动"输入"矩形右移,连线起点应跟随重算
const inputRect = await page.evaluate(() => {
  const r = document.querySelector(".vl-canvas-host svg rect").getBoundingClientRect();
  return { x: r.x + 4, y: r.y + 4 };
});
const startX = await page.evaluate(() => {
  const poly = document.querySelector(".vl-canvas-host svg polyline[data-vl-anchor]");
  return poly ? +poly.getAttribute("points").split(" ")[0].split(",")[0] : null;
});
await page.mouse.move(inputRect.x, inputRect.y);
await page.mouse.down();
await page.mouse.move(inputRect.x + 40, inputRect.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(200);
const newStartX = await page.evaluate(() => {
  const poly = document.querySelector(".vl-canvas-host svg polyline[data-vl-anchor]");
  return poly ? +poly.getAttribute("points").split(" ")[0].split(",")[0] : null;
});
console.log("拖动后起点:", startX, "→", newStartX, newStartX > startX ? "✓ 跟随重算" : "✗ 未跟随");

// 3. 菱形边界相交:添加菱形,从它拖连线到矩形,终点应在菱形边界
await page.locator("text=SVG 画布编辑").dispatchEvent("click"); // 确保画布聚焦
await page.evaluate(() => {
  // 直接调 addElement 经 UI 按钮太脆,用键盘不够;改点工具栏
});
const diamondBtn = page.locator('button[title="添加菱形(判断)"]');
await diamondBtn.dispatchEvent("click");
await page.waitForTimeout(200);
const hasDiamond = await page.evaluate(() => !!document.querySelector(".vl-canvas-host svg polygon[data-vl-shape='diamond']"));
console.log("菱形已添加:", hasDiamond ? "✓" : "✗");

await browser.close();
