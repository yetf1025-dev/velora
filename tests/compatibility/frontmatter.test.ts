/** frontmatter 回归:长 frontmatter 不卡死 + 语义与旧版一致 */
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { veloraBaseExtensions } from "../../src/editor/extensions";

function createEditor(markdown: string) {
  return new Editor({
    element: document.createElement("div"),
    extensions: veloraBaseExtensions(),
    content: markdown,
    contentType: "markdown",
  });
}

/** 与 design.md 同形:stepsCompleted 几十项的长 frontmatter */
function longFrontmatter(bodyLines: number, eol = "\n") {
  const steps = Array.from({ length: bodyLines }, (_, i) => `  - v2.${i + 1}-step`);
  const body = ["title: t", "stepsCompleted:", ...steps].join(eol);
  return `---${eol}${body}${eol}---${eol}${eol}# 正文${eol}${eol}段落。${eol}`;
}

function frontmatterSource(markdown: string): string | undefined {
  const e = createEditor(markdown);
  const doc = e.getJSON();
  e.destroy();
  const fm = doc.content?.find((n) => n.type === "frontmatter");
  return fm?.attrs?.source as string | undefined;
}

describe("frontmatter tokenizer", () => {
  it("48 行 body(design.md 形态)在 5s 内解析并认领", () => {
    const src = frontmatterSource(longFrontmatter(47)); // 1 行 key + 47 行列表 = 48 行 body
    expect(src).toContain("title: t");
    expect(src).toContain("- v2.47-step");
    expect(src?.endsWith("---")).toBe(true);
  });

  it("100 行 body(新上限,含 stepsCompleted: 头行)仍可认领", () => {
    // title + stepsCompleted 头 + 98 项 = 100 行 body
    expect(frontmatterSource(longFrontmatter(98))).toContain("- v2.98-step");
  });

  it("超过 100 行 body 不认领但不卡死", () => {
    expect(frontmatterSource(longFrontmatter(150))).toBeUndefined();
  });

  it("29/30 行阈值不再存在(旧版 30 行起灾难性回溯卡死)", () => {
    expect(frontmatterSource(longFrontmatter(29))).toBeDefined();
    expect(frontmatterSource(longFrontmatter(30))).toBeDefined();
  });

  it("CRLF 文件可认领(旧版闭合行匹配不到 \\r)", () => {
    const src = frontmatterSource(longFrontmatter(3, "\r\n"));
    expect(src).toContain("title: t");
  });

  it("无闭合 --- 不认领(不能把正文吞进去)", () => {
    expect(frontmatterSource("---\ntitle: t\nstill yaml\n\n# 正文\n")).toBeUndefined();
  });

  it("body 空行后不认领(与旧版语义一致)", () => {
    expect(frontmatterSource("---\ntitle: t\n\n---\n# 正文\n")).toBeUndefined();
  });

  it("首行非 key: 形式不认领", () => {
    expect(frontmatterSource("---\n# 标题不是YAML\n---\n")).toBeUndefined();
  });

  it("长 frontmatter round-trip 幂等", () => {
    const md = longFrontmatter(40);
    const e1 = createEditor(md);
    const once = e1.getMarkdown();
    e1.destroy();
    const e2 = createEditor(once);
    expect(e2.getMarkdown()).toBe(once);
    e2.destroy();
  });
});
