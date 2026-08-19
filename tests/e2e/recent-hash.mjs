import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
// 带 hash 的 URL → 模拟多窗口传参
await page.goto("http://localhost:1420/#open=" + encodeURIComponent("/tmp/e2e-test.md"), { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const r = await page.evaluate(() => ({
  // openFilePath 会失败(文件不存在,浏览器模式),但不应崩溃;
  // 无恢复逻辑冲突
  editorAlive: !!document.querySelector(".velora-editor"),
}));
console.log("hash 传参不崩溃:", r.editorAlive ? "✓" : "✗");
await browser.close();
