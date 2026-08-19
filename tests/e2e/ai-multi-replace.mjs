import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".velora-editor", { timeout: 10000 });

await page.evaluate(() => {
  const ed = window.__velora.getEditor();
  ed.commands.setContent("# 文档\n\n## 挑战\n\n原始内容 A。", { contentType: "markdown" });
});
await page.waitForTimeout(300);

// 第一轮替换
await page.evaluate(() => {
  window.__velora.previewReplaceHeading("## 挑战\n\n第一版修改。", "挑战");
});
await page.waitForTimeout(300);
const v1 = await page.evaluate(() => ({
  preview: !!document.querySelector(".vl-ai-preview"),
  del: !!document.querySelector(".vl-ai-delete"),
  nw: !!document.querySelector(".vl-ai-new"),
}));

// 第二轮替换(不满意,再来)——关键断言:原文必须恢复且新预览基于原文
await page.evaluate(() => {
  window.__velora.previewReplaceHeading("## 挑战\n\n第二版修改(最终)。", "挑战");
});
await page.waitForTimeout(300);
const v2 = await page.evaluate(() => {
  const text = document.querySelector(".velora-editor")?.innerText || "";
  return {
    preview: !!document.querySelector(".vl-ai-preview"),
    del: !!document.querySelector(".vl-ai-delete"),
    nw: !!document.querySelector(".vl-ai-new"),
    originalKept: text.includes("原始内容 A"),   // 原文作为删除标记保留
    v1Gone: !text.includes("第一版修改"),         // 上一版建议被 revert
    v2Present: text.includes("第二版修改"),
  };
});
console.log("第一轮:", JSON.stringify(v1));
console.log("第二轮:", JSON.stringify(v2));

// 应用后:原文删,第二版留
await page.locator(".vl-ai-preview-apply").click();
await page.waitForTimeout(300);
const applied = await page.evaluate(() => {
  const text = document.querySelector(".velora-editor")?.innerText || "";
  return {
    originalGone: !text.includes("原始内容 A"),
    v2Kept: text.includes("第二版修改"),
    previewGone: !document.querySelector(".vl-ai-preview"),
  };
});
console.log("应用后:", JSON.stringify(applied));
await browser.close();
