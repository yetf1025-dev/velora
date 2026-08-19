import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".velora-editor", { timeout: 10000 });

// 第一轮建议
await page.evaluate(() => {
  const ed = window.__velora.getEditor();
  ed.commands.setContent("# 文档\n\n## 背景\n\n背景内容", { contentType: "markdown" });
  window.__velora.previewAiContent("第一版建议内容", { atEnd: true });
});
await page.waitForTimeout(300);
const v1 = await page.evaluate(() => ({
  count: document.querySelectorAll(".vl-ai-preview").length,
  text: document.querySelector(".vl-ai-preview")?.innerText?.slice(0, 30),
}));

// 第二轮建议(用户不满意继续聊,新建议)
await page.evaluate(() => {
  window.__velora.previewAiContent("第二版建议内容(修改后)", { atEnd: true });
});
await page.waitForTimeout(300);
const v2 = await page.evaluate(() => ({
  count: document.querySelectorAll(".vl-ai-preview").length,
  text: document.querySelector(".vl-ai-preview")?.innerText?.slice(0, 40),
  hasV1: document.querySelector(".velora-editor")?.innerText.includes("第一版建议内容"),
}));

console.log("第一轮:", JSON.stringify(v1));
console.log("第二轮(应只有第二版,第一版已清):", JSON.stringify(v2));
console.log("预览数量=1 且内容已更新:", v2.count === 1 && !v2.hasV1 ? "✓" : "✗");
await browser.close();
