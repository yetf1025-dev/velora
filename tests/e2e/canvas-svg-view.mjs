// SVG 节点交互:单击放大、双击源码、Esc/点外部回图片
import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".vl-svg-canvas svg", { timeout: 10000 });
await page.locator(".vl-svg-canvas").scrollIntoViewIfNeeded();

// 1. 单击 → 放大 overlay
const pt = await page.evaluate(() => {
  const c = document.querySelector(".vl-svg-canvas").getBoundingClientRect();
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
});
await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(400);
const zoomed = await page.evaluate(() => !!document.querySelector(".vl-svg-overlay"));
console.log("单击放大:", zoomed ? "✓" : "✗");
// Esc 关闭 overlay
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
const afterEsc = await page.evaluate(() => !document.querySelector(".vl-svg-overlay"));
console.log("Esc 关闭放大:", afterEsc ? "✓" : "✗");

// 2. 双击 → 源码编辑
await page.mouse.dblclick(pt.x, pt.y);
await page.waitForTimeout(200);
const editing = await page.evaluate(() => !!document.querySelector(".vl-svg-source"));
console.log("双击进源码:", editing ? "✓" : "✗");
// Esc 退出编辑回图片
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
const backToImg = await page.evaluate(() => !document.querySelector(".vl-svg-source"));
console.log("Esc 回图片:", backToImg ? "✓" : "✗");

// 3. 再进编辑,点外部应提交并回图片
await page.mouse.dblclick(pt.x, pt.y);
await page.waitForTimeout(200);
await page.mouse.click(50, 50); // 点左上角空白
await page.waitForTimeout(200);
const afterOutside = await page.evaluate(() => !document.querySelector(".vl-svg-source"));
console.log("点外部回图片:", afterOutside ? "✓" : "✗");
await browser.close();
