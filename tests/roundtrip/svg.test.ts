import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { SvgBlockParser, SvgNode } from "../../src/editor/extensions/svg/SvgNode";

function createEditor(markdown: string): Editor {
  return new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, Markdown, SvgNode, SvgBlockParser],
    content: markdown,
    contentType: "markdown",
  });
}

describe("SVG 节点 Markdown 映射", () => {
  it("![alt](x.svg) 解析为 svgBlock 而非 image", () => {
    const editor = createEditor("![架构图](./assets/arch.svg)");
    const node = editor.getJSON().content?.[0];
    expect(node?.type).toBe("svgBlock");
    expect(node?.attrs?.src).toBe("./assets/arch.svg");
    expect(node?.attrs?.alt).toBe("架构图");
    editor.destroy();
  });

  it("普通 png 图片仍是 image", () => {
    const editor = createEditor("![截图](./shot.png)");
    const json = editor.getJSON();
    const text = JSON.stringify(json);
    expect(text).not.toContain("svgBlock");
    editor.destroy();
  });

  it("内联 <svg> 解析为 svgBlock 并保留源码", () => {
    const md = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    const editor = createEditor(md);
    const node = editor.getJSON().content?.[0];
    expect(node?.type).toBe("svgBlock");
    expect(node?.attrs?.source).toContain("<svg");
    editor.destroy();
  });

  it("svgBlock(文件来源)序列化回 ![alt](src)", () => {
    const md = "![架构图](./assets/arch.svg)";
    const editor = createEditor(md);
    expect(editor.getMarkdown()).toContain("![架构图](./assets/arch.svg)");
    editor.destroy();
  });
});
