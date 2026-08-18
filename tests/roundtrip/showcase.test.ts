/**
 * Round-trip 测试:given markdown → parse → serialize → 再 parse → 再 serialize。
 *
 * 验收策略(ADR-001):语义无损 + 风格归一,不要求字节级一致。
 * 因此断言「二次序列化稳定」(幂等)+ 关键语义片段存在。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Mathematics } from "@tiptap/extension-mathematics";
import { DetailsNode } from "../../src/editor/extensions/details/DetailsNode";
import { MermaidNode } from "../../src/editor/extensions/mermaid/MermaidNode";
import {
  SvgBlockParser,
  SvgNode,
} from "../../src/editor/extensions/svg/SvgNode";

function createEditor(markdown: string): Editor {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit,
      Markdown,
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit,
      MermaidNode,
      DetailsNode,
      SvgNode,
      SvgBlockParser,
      Mathematics,
    ],
    content: markdown,
    contentType: "markdown",
  });
}

function roundTrip(markdown: string): { once: string; twice: string } {
  const e1 = createEditor(markdown);
  const once = e1.getMarkdown();
  e1.destroy();
  const e2 = createEditor(once);
  const twice = e2.getMarkdown();
  e2.destroy();
  return { once, twice };
}

const fixture = readFileSync(
  join(__dirname, "../fixtures/showcase.md"),
  "utf-8",
);

describe("Markdown round-trip(showcase.md)", () => {
  it("序列化幂等:parse→serialize→parse→serialize 结果稳定", () => {
    const { once, twice } = roundTrip(fixture);
    expect(twice).toBe(once);
  });

  it("语义保留:关键内容片段在往返后仍然存在", () => {
    const { once } = roundTrip(fixture);
    const expected = [
      "# Velora Round-Trip 测试样例",
      "**粗体**",
      "[一个链接](https://velora.dev)",
      "![截图](./assets/shot.png)",
      "- [x] 已完成任务",
      "interface Doc",
      "| ---",
      "```mermaid",
      "A[用户] --> B{是否压缩}",
      "![架构图](./assets/arch.svg)",
      '<svg viewBox="0 0 100 40"',
      "E = mc^2",
    ];
    for (const fragment of expected) {
      expect(once, `缺少片段: ${fragment}`).toContain(fragment);
    }
  });

  it("结构保留:mermaid / svgBlock / 数学节点类型正确", () => {
    const editor = createEditor(fixture);
    const types = (editor.getJSON().content ?? []).map((n) => n.type);
    expect(types).toContain("mermaid");
    expect(types.filter((t) => t === "svgBlock")).toHaveLength(2);
    expect(types.some((t) => t?.toLowerCase().includes("math"))).toBe(true);
    editor.destroy();
  });
});
