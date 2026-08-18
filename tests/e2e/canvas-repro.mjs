// SVG 画布编辑器复现脚本:WebKit 打开应用 → 点击 SVG → 画布编辑 → 截图+诊断
import { webkit } from "playwright";

const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("console", (m) => console.log("[console]", m.type(), m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto("http://localhost:1420", { waitUntil: "networkidle" });

// 1. 等待文档里的 SVG 渲染
await page.waitForSelector(".vl-svg-canvas svg", { timeout: 10000 });
console.log("step1: 文档内 SVG 已渲染");

// 2. 点击 SVG → Inspector 出现 SVG 面板
await page.click(".vl-svg-canvas");
await page.waitForSelector("text=画布编辑", { timeout: 5000 });
console.log("step2: Inspector 已出现");

// 3. 点击画布编辑
await page.click("text=画布编辑");
await page.waitForSelector(".vl-canvas-host", { timeout: 5000 });
await page.waitForTimeout(600);

// 4. 诊断
const diag = await page.evaluate(() => {
  const host = document.querySelector(".vl-canvas-host");
  const svg = host?.querySelector("svg");
  const dialog = document.querySelector(".vl-dialog");
  return {
    hostExists: !!host,
    hostInnerLength: host?.innerHTML.length ?? 0,
    svgExists: !!svg,
    svgBBox: svg ? svg.getBoundingClientRect().toJSON() : null,
    dialogBox: dialog ? dialog.getBoundingClientRect().toJSON() : null,
    svgOuterStart: svg ? svg.outerHTML.slice(0, 200) : null,
    hostComputedDisplay: host ? getComputedStyle(host).display : null,
  };
});
console.log(JSON.stringify(diag, null, 2));

await page.screenshot({ path: "/tmp/velora-canvas.png", fullPage: true });
await browser.close();
console.log("screenshot: /tmp/velora-canvas.png");
