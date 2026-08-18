import { describe, expect, it } from "vitest";
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

describe("TOC 目录节点", () => {
  it("独占一行的 [TOC] 解析为 toc 节点", () => {
    const editor = createEditor("# 标题\n\n[TOC]\n\n正文");
    const types = (editor.getJSON().content ?? []).map((n) => n.type);
    expect(types).toEqual(["heading", "toc", "paragraph"]);
    editor.destroy();
  });

  it("普通 [text] 段落不受影响", () => {
    const editor = createEditor("[TOCX] 不是目录");
    expect(editor.getJSON().content?.[0]?.type).toBe("paragraph");
    editor.destroy();
  });

  it("toc 节点序列化回 [TOC]", () => {
    const editor = createEditor("[TOC]");
    expect(editor.getMarkdown()).toContain("[TOC]");
    editor.destroy();
  });

  // 回归:token 注册表先序查找曾导致所有段落被渲染成 [TOC]
  it("普通段落序列化不受 toc 影响", () => {
    const md = "# 标题\n\n第一段普通文字。\n\n[TOC]\n\n第二段普通文字。";
    const editor = createEditor(md);
    const out = editor.getMarkdown();
    expect(out).toContain("第一段普通文字。");
    expect(out).toContain("第二段普通文字。");
    expect(out).toContain("[TOC]");
    // [TOC] 只能出现一次
    expect(out.match(/\[TOC\]/g)).toHaveLength(1);
    editor.destroy();
  });
});
