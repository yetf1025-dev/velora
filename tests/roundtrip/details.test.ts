import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { veloraBaseExtensions } from "../../src/editor/extensions";

const DETAILS_MD = `<details>
<summary>部署步骤</summary>

第一步:构建

\`\`\`bash
pnpm build
\`\`\`

</details>`;

function createEditor(markdown: string): Editor {
  return new Editor({
    element: document.createElement("div"),
    extensions: veloraBaseExtensions(),
    content: markdown,
    contentType: "markdown",
  });
}

describe("Details 折叠块", () => {
  it("<details> 解析为 details 节点,summary 存属性,内容为子节点", () => {
    const editor = createEditor(DETAILS_MD);
    const node = editor.getJSON().content?.[0];
    expect(node?.type).toBe("details");
    expect(node?.attrs?.summary).toBe("部署步骤");
    const childTypes = (node?.content ?? []).map((n) => n.type);
    expect(childTypes).toContain("paragraph");
    expect(childTypes).toContain("codeBlock");
    editor.destroy();
  });

  it("序列化回 <details> 结构", () => {
    const editor = createEditor(DETAILS_MD);
    const out = editor.getMarkdown();
    expect(out).toContain("<details");
    expect(out).toContain("<summary>部署步骤</summary>");
    expect(out).toContain("</details>");
    expect(out).toContain("pnpm build");
    editor.destroy();
  });

  it("round-trip 幂等", () => {
    const e1 = createEditor(DETAILS_MD);
    const once = e1.getMarkdown();
    e1.destroy();
    const e2 = createEditor(once);
    expect(e2.getMarkdown()).toBe(once);
    e2.destroy();
  });

  it("折叠块内的 mermaid 仍是 mermaid 节点", () => {
    const md = `<details>
<summary>架构图</summary>

\`\`\`mermaid
graph LR
    A --> B
\`\`\`

</details>`;
    const editor = createEditor(md);
    const node = editor.getJSON().content?.[0];
    expect(node?.type).toBe("details");
    expect(node?.content?.[0]?.type).toBe("mermaid");
    editor.destroy();
  });
});
