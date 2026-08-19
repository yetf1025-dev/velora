/** 欢迎文档(旅程)回归:每个特性区块都在,round-trip 幂等 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Editor } from "@tiptap/core";
import { veloraBaseExtensions } from "../../src/editor/extensions";

const md = readFileSync(join(__dirname, "../fixtures/welcome.md"), "utf-8");

function createEditor(markdown: string) {
  return new Editor({
    element: document.createElement("div"),
    extensions: veloraBaseExtensions(),
    content: markdown,
    contentType: "markdown",
  });
}

describe("欢迎文档 · Velora 之旅", () => {
  it("解析 + 二次序列化幂等", () => {
    const e1 = createEditor(md);
    const once = e1.getMarkdown();
    e1.destroy();
    const e2 = createEditor(once);
    expect(e2.getMarkdown()).toBe(once);
    e2.destroy();
  });

  it("七个站点全部保留", () => {
    const e = createEditor(md);
    const out = e.getMarkdown();
    e.destroy();
    for (const station of [
      "第 1 站 · 所见即所得",
      "第 2 站 · Mermaid 一等公民",
      "第 3 站 · SVG 一等公民",
      "第 4 站 · AI 能力",
      "第 5 站 · 项目与 Git",
      "第 6 站 · 数据安全",
      "第 7 站 · 导出",
    ]) {
      expect(out, `缺少站点: ${station}`).toContain(station);
    }
  });

  it("结构节点齐备:frontmatter/TOC/mermaid×2/svg/数学/折叠块/表格/任务列表", () => {
    const e = createEditor(md);
    const types = JSON.stringify(e.getJSON());
    const out = e.getMarkdown();
    e.destroy();
    expect(types).toContain('"frontmatter"');
    expect(types).toContain('"toc"');
    expect(types.match(/"mermaid"/g)?.length).toBe(2);
    expect(types).toContain('"svgBlock"');
    expect(types).toContain('"details"');
    expect(out).toContain("E = mc^2");
    expect(out).toContain("- [x] 打开 Velora");
  });
});
