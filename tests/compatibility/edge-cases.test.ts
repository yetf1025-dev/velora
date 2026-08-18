/**
 * Markdown 兼容性套件:从 CommonMark/GitHub/Typora/Obsidian 迁移不丢内容。
 *
 * 策略:对每个语义点,断言 round-trip(parse → serialize)后关键内容片段保留。
 * 暴露 Tiptap Markdown 解析的真实漏洞 → 决定补哪些扩展。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Editor } from "@tiptap/core";
import { veloraBaseExtensions } from "../../src/editor/extensions";

function createEditor(markdown: string): Editor {
  return new Editor({
    element: document.createElement("div"),
    extensions: veloraBaseExtensions(),
    content: markdown,
    contentType: "markdown",
  });
}

function roundTrip(md: string): { once: string; json: ReturnType<Editor["getJSON"]> } {
  const e1 = createEditor(md);
  const once = e1.getMarkdown();
  const json = e1.getJSON();
  e1.destroy();
  return { once, json };
}

const fixture = readFileSync(
  join(__dirname, "fixtures/edge-cases.md"),
  "utf-8",
);

describe("Markdown 兼容性 · 边界用例", () => {
  it("round-trip 稳定(幂等)", () => {
    const { once } = roundTrip(fixture);
    const e2 = createEditor(once);
    const twice = e2.getMarkdown();
    e2.destroy();
    // 不要求字节级一致,但二次序列化应稳定
    expect(twice).toBe(once);
  });

  it("嵌套列表层级保留", () => {
    const { once } = roundTrip(fixture);
    expect(once).toContain("一级 A");
    expect(once).toContain("二级 A1");
    expect(once).toContain("三级 A1a");
    expect(once).toContain("嵌套有序");
  });

  it("任务列表保留勾选状态", () => {
    const { once } = roundTrip(fixture);
    // 已勾选项应保留 [x]
    expect(once).toContain("[x]");
    expect(once).toContain("[ ]");
  });

  it("表格内容保留", () => {
    const { once } = roundTrip(fixture);
    // 表格按列宽对齐,不假定单空格;断言表格结构与关键内容
    expect(once).toMatch(/\| *左.*\|.*中.*\|.*右.*\|/);
    expect(once).toMatch(/\| *a.*\|.*b.*\|.*c.*\|/);
    expect(once).toContain("长内容长内容");
  });

  it("脚注引用保留(GitHub/Typora) — 已知:脚注完整支持待加 footnote 扩展", () => {
    const { once } = roundTrip(fixture);
    // 脚注标记 [^1] 字符至少保留(完整定义渲染待 footnote 扩展)
    expect(once).toContain("[^1]");
  });

  it("转义字符保留", () => {
    const { once } = roundTrip(fixture);
    expect(once).toContain("\\*");
    expect(once).toContain("\\[x\\]");
  });

  it("Unicode / Emoji 保留", () => {
    const { once } = roundTrip(fixture);
    expect(once).toContain("🚀");
    expect(once).toContain("【】");
    expect(once).toContain("123");
  });

  it("代码围栏(波浪号)内容保留", () => {
    const { once } = roundTrip(fixture);
    expect(once).toContain("let x = 1");
  });

  it("引用链接 [ref]: 保留", () => {
    const { once } = roundTrip(fixture);
    expect(once).toContain("https://b.com");
  });

  it("自动链接 <url> 保留", () => {
    const { once } = roundTrip(fixture);
    expect(once).toContain("https://auto.link");
  });

  it("JSON 结构:标题/列表/表格/代码块类型正确", () => {
    const { json } = roundTrip(fixture);
    const types = JSON.stringify(json);
    expect(types).toContain('"heading"');
    expect(types).toContain('"bulletList"');
    expect(types).toContain('"orderedList"');
    expect(types).toContain('"table"');
    expect(types).toContain('"codeBlock"');
    expect(types).toContain('"blockquote"');
  });
});
