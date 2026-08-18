import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { MermaidNode } from "../../src/editor/extensions/mermaid/MermaidNode";

function createEditor(markdown: string): Editor {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit,
      Markdown,
      MermaidNode, // 测试用无 NodeView 版本(NodeView 需要完整 React 环境)
    ],
    content: markdown,
    contentType: "markdown",
  });
}

describe("Mermaid 节点 Markdown 映射", () => {
  it("```mermaid 代码块解析为 mermaid 节点而非 codeBlock", () => {
    const editor = createEditor("```mermaid\ngraph LR\n    A --> B\n```");
    const json = editor.getJSON();
    expect(json.content?.[0]?.type).toBe("mermaid");
    expect(json.content?.[0]?.attrs?.source).toBe("graph LR\n    A --> B");
    editor.destroy();
  });

  it("其他语言代码块仍是 codeBlock", () => {
    const editor = createEditor("```ts\nconst a = 1\n```");
    const json = editor.getJSON();
    expect(json.content?.[0]?.type).toBe("codeBlock");
    editor.destroy();
  });

  it("mermaid 节点序列化回 ```mermaid 围栏", () => {
    const md = "```mermaid\ngraph LR\n    A --> B\n```";
    const editor = createEditor(md);
    const out = editor.getMarkdown();
    expect(out).toContain("```mermaid");
    expect(out).toContain("graph LR");
    expect(out).toContain("A --> B");
    editor.destroy();
  });
});
