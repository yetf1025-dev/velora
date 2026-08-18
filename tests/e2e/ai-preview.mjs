import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
await page.waitForSelector(".velora-editor", { timeout: 10000 });

// 模拟 AI 回复后直接插入预览块(不经对话面板,直接调 controller 等效路径)
await page.evaluate(() => {
  const ed = window.__velora.getEditor();
  // 等效 previewAiContent:解析 markdown 为节点包进 aiPreview
  const docJson = ed.markdown.parse("## AI 生成的章节\n\n这是建议内容。\n\n- 要点一\n- 要点二");
  ed.chain().insertContentAt(ed.state.doc.content.size, {
    type: "aiPreview",
    content: docJson.content,
  }).run();
});
await page.waitForTimeout(300);

const state = await page.evaluate(() => ({
  previewExists: !!document.querySelector(".vl-ai-preview"),
  hasContent: document.querySelector(".vl-ai-preview")?.innerText.includes("AI 生成的章节"),
  hasApply: !!document.querySelector(".vl-ai-preview-apply"),
}));
console.log("预览块:", JSON.stringify(state));

// 点应用
await page.locator(".vl-ai-preview-apply").click();
await page.waitForTimeout(300);
const afterApply = await page.evaluate(() => ({
  previewGone: !document.querySelector(".vl-ai-preview"),
  contentExists: document.querySelector(".velora-editor")?.innerText.includes("AI 生成的章节"),
  isHeading: !!document.querySelector(".velora-editor h2"),
}));
console.log("应用后:", JSON.stringify(afterApply));

// 再插一个,点拒绝
await page.evaluate(() => {
  const ed = window.__velora.getEditor();
  const docJson = ed.markdown.parse("拒绝内容");
  ed.chain().insertContentAt(ed.state.doc.content.size, { type: "aiPreview", content: docJson.content }).run();
});
await page.waitForTimeout(200);
await page.locator(".vl-ai-preview-reject").click();
await page.waitForTimeout(200);
const afterReject = await page.evaluate(() => ({
  previewGone: !document.querySelector(".vl-ai-preview"),
  rejectedContentGone: !document.querySelector(".velora-editor")?.innerText.includes("拒绝内容"),
}));
console.log("拒绝后:", JSON.stringify(afterReject));
await browser.close();
