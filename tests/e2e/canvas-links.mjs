// 联动拖拽验证:移动"输入"矩形 → 其文字标签和连线端点应跟随
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

const pt = await page.evaluate(() => {
  const r = document.querySelector(".vl-canvas-host svg rect").getBoundingClientRect();
  return { x: r.x + 4, y: r.y + 4 };
});
await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(200);

const grab = () => page.evaluate(() => {
  const q = (s) => document.querySelector(".vl-canvas-host svg " + s);
  return {
    rect: { x: +q("rect").getAttribute("x") },
    text: { x: +q("text").getAttribute("x"), y: +q("text").getAttribute("y") },
    line: { x1: +q("line").getAttribute("x1"), y1: +q("line").getAttribute("y1") },
  };
});
const before = await grab();

await page.mouse.move(pt.x, pt.y);
await page.mouse.down();
await page.mouse.move(pt.x + 50, pt.y + 30, { steps: 5 });
await page.mouse.up();
const after = await grab();

console.log("rect.x:  ", before.rect.x, "→", after.rect.x, after.rect.x === before.rect.x + 50 ? "✓" : "✗");
console.log("text.x:  ", before.text.x, "→", after.text.x, after.text.x === before.text.x + 50 ? "✓ 标签跟随" : "✗ 标签未跟随");
console.log("line.x1: ", before.line.x1, "→", after.line.x1, after.line.x1 === before.line.x1 + 50 ? "✓ 连线端点跟随" : "✗ 端点未跟随");
await browser.close();
