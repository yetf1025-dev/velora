import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".velora-editor", { timeout: 10000 });

// ⌘+滚轮上(放大)三格
await page.keyboard.down("Meta");
await page.mouse.wheel(0, -120);
await page.mouse.wheel(0, -120);
await page.mouse.wheel(0, -120);
await page.keyboard.up("Meta");
await page.waitForTimeout(300);
const r1 = await page.evaluate(() =>
  [...document.querySelectorAll("footer button, footer span")].map(e => e.textContent).find(t => t?.endsWith("%")) ?? "未显示");
console.log("⌘滚轮上×3:", r1, parseFloat(r1) > 100 ? "✓" : "✗");

// ⌘+滚轮下(缩小)
await page.keyboard.down("Meta");
await page.mouse.wheel(0, 120);
await page.keyboard.up("Meta");
await page.waitForTimeout(300);
const r2 = await page.evaluate(() =>
  [...document.querySelectorAll("footer button, footer span")].map(e => e.textContent).find(t => t?.endsWith("%")) ?? "?");
console.log("⌘滚轮下×1:", r2, parseFloat(r2) < parseFloat(r1) ? "✓" : "✗");

// 普通滚轮不触发缩放(状态不变)
await page.mouse.wheel(0, -120);
await page.waitForTimeout(200);
const r3 = await page.evaluate(() =>
  [...document.querySelectorAll("footer button, footer span")].map(e => e.textContent).find(t => t?.endsWith("%")) ?? "?");
console.log("普通滚轮不缩放:", r3 === r2 ? "✓" : "✗ " + r3);

// ⌘0 重置
await page.keyboard.press("Meta+0");
await page.waitForTimeout(200);
console.log("⌘0 重置:", await page.evaluate(() =>
  ![...document.querySelectorAll("footer button, footer span")].map(e => e.textContent).some(t => t?.endsWith("%"))) ? "✓" : "✗");
await browser.close();
