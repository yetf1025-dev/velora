import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".velora-editor", { timeout: 10000 });

// 设置一个带「挑战与风险」章节的文档
await page.evaluate(() => {
  const ed = window.__velora.getEditor();
  ed.commands.setContent("# 设计文档\n\n## 背景\n\n背景内容\n\n## 挑战与风险\n\n旧的风险内容。\n\n## 展望\n\n展望内容", { contentType: "markdown" });
});
await page.waitForTimeout(300);

// 替换「挑战与风险」章节
await page.evaluate(async () => {
  const mod = window.__velora;
  return mod.previewReplaceHeading("## 挑战与风险\n\n新的风险:数据安全 + 信任分化。", "挑战与风险");
});
await page.waitForTimeout(400);

const preview = await page.evaluate(() => ({
  hasPreview: !!document.querySelector(".vl-ai-preview"),
  hasDelete: !!document.querySelector(".vl-ai-delete"),
  deleteText: document.querySelector(".vl-ai-delete")?.innerText?.slice(0, 30),
  newTextPresent: document.querySelector(".vl-ai-preview")?.innerText.includes("数据安全"),
}));
console.log("预览:", JSON.stringify(preview));

// 应用:旧的删,新的留
await page.locator(".vl-ai-preview-apply").click();
await page.waitForTimeout(300);
const afterApply = await page.evaluate(() => {
  const text = document.querySelector(".velora-editor")?.innerText || "";
  return {
    oldGone: !text.includes("旧的风险内容"),
    newKept: text.includes("数据安全"),
    previewGone: !document.querySelector(".vl-ai-preview"),
    backgroundKept: text.includes("背景内容"),
    outlookKept: text.includes("展望内容"),
  };
});
console.log("应用后:", JSON.stringify(afterApply));
await browser.close();
