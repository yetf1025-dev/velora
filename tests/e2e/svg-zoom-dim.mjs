import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".vl-svg-canvas svg", { timeout: 10000 });
await page.locator(".vl-svg-canvas").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);

const box = await page.locator(".vl-svg-canvas").boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(500);

const state = await page.evaluate(() => {
  const side = document.querySelector(".vl-dimmable-panel");
  return {
    attr: document.querySelector("#root > div")?.getAttribute("data-svg-zoom"),
    overlayOpen: !!document.querySelector(".vl-svg-overlay"),
    sideFilter: side ? getComputedStyle(side).filter : "none",
    sidePointerEvents: side ? getComputedStyle(side).pointerEvents : "",
  };
});
console.log("放大后:", JSON.stringify(state));

await page.keyboard.press("Escape");
await page.waitForTimeout(600);
const closed = await page.evaluate(() => {
  const side = document.querySelector(".vl-dimmable-panel");
  return {
    attrCleared: !document.querySelector("#root > div")?.getAttribute("data-svg-zoom"),
    overlayGone: !document.querySelector(".vl-svg-overlay"),
    filterRestored: !side || getComputedStyle(side).filter === "none",
  };
});
console.log("Esc 后:", JSON.stringify(closed));
await browser.close();
