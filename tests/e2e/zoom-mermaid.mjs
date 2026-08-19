import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".vl-mermaid-diagram svg", { timeout: 15000 });
await page.locator(".vl-mermaid").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
const box = await page.locator(".vl-mermaid").first().boundingBox();
if (box.y > 850 || box.y < 0) throw new Error("图不在视口内 y=" + box.y);

// 1. 单击选中 → Inspector 上下文
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(400);
const selected = await page.evaluate(() => ({
  inspector: document.body.innerText.includes("Mermaid 图表"),
}));
console.log("单击选中(Inspector):", selected.inspector ? "✓" : "✗");

// 2. 角标放大按钮
await page.locator(".vl-mermaid-zoom").first().click({ force: true });
await page.waitForTimeout(500);
const opened = await page.evaluate(() => ({
  overlay: !!document.querySelector(".vl-svg-overlay"),
  hasSvg: !!document.querySelector(".vl-svg-overlay-content svg"),
  percent: document.querySelector(".vl-zoom-percent")?.textContent,
}));
console.log("角标放大:", opened.overlay && opened.hasSvg ? "✓ " + opened.percent : "✗");

// 3. 滚轮
await page.mouse.wheel(0, -600);
await page.waitForTimeout(300);
const zoomed = await page.evaluate(() => document.querySelector(".vl-zoom-percent")?.textContent);
console.log("滚轮缩放:", parseInt(zoomed) > 100 ? "✓ " + zoomed : "✗");

// 4. 拖拽平移(放大后)
await page.mouse.move(800, 450);
await page.mouse.down(); await page.mouse.move(900, 500); await page.mouse.up();
console.log("拖拽平移: ✓(无崩溃)");

// 5. 适应窗口(双击)
await page.mouse.dblclick(800, 450);
await page.waitForTimeout(300);
const fit = await page.evaluate(() => document.querySelector(".vl-zoom-percent")?.textContent);
console.log("适应窗口:", parseInt(fit) <= 100 ? "✓ " + fit : "✗ " + fit);

// 6. Esc
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
console.log("Esc 关闭:", await page.evaluate(() => !document.querySelector(".vl-svg-overlay")) ? "✓" : "✗");
await browser.close();
