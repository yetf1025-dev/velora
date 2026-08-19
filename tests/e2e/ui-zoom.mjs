import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".velora-editor", { timeout: 10000 });

// ⌘+ 三次(浏览器模式 setZoom 不可用,验证状态与状态栏显示)
await page.keyboard.press("Meta+Shift+=");
await page.waitForTimeout(200);
await page.keyboard.press("Meta+=");
await page.waitForTimeout(200);
const r1 = await page.evaluate(() => {
  const pct = [...document.querySelectorAll("footer button, footer span")].map(e => e.textContent).find(t => t?.endsWith("%"));
  return { zoomPct: pct ?? "未显示" };
});
console.log("两次 ⌘+ 后状态栏:", JSON.stringify(r1));

// ⌘0 重置
await page.keyboard.press("Meta+0");
await page.waitForTimeout(200);
const r2 = await page.evaluate(() => {
  const pct = [...document.querySelectorAll("footer button, footer span")].map(e => e.textContent).find(t => t?.endsWith("%"));
  return { zoomPct: pct ?? "已重置(不显示)" };
});
console.log("⌘0 后:", JSON.stringify(r2));
await browser.close();
