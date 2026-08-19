import { describe, expect, it } from "vitest";
import { extractEdits } from "../../src/ai/aiEditParser";

describe("AI edit 块解析", () => {
  it("解析 after-heading 定位", () => {
    const r = extractEdits(
      '说明文字\n\n```edit\n<!-- after-heading: 挑战与风险 -->\n新增内容\n```\n',
    );
    expect(r).toEqual([
      { content: "新增内容", afterHeading: "挑战与风险", atEnd: false },
    ]);
  });

  it("解析 at-end", () => {
    const r = extractEdits("```edit\n<!-- at-end -->\n末尾内容\n```");
    expect(r[0].atEnd).toBe(true);
  });

  it("无定位注释则 afterHeading/atEnd 都空", () => {
    const r = extractEdits("```edit\n直接内容\n```");
    expect(r[0].content).toBe("直接内容");
    expect(r[0].afterHeading).toBeUndefined();
    expect(r[0].atEnd).toBe(false);
  });

  it("普通代码块不误判", () => {
    expect(extractEdits("```ts\nconst a=1\n```")).toEqual([]);
  });

  it("多个 edit 块都提取", () => {
    const r = extractEdits("```edit\n甲\n```\n\n```edit\n乙\n```");
    expect(r).toHaveLength(2);
  });

  it("edit 块内容保留多行与 markdown 结构", () => {
    const r = extractEdits("```edit\n<!-- at-end -->\n## 标题\n\n- a\n- b\n```");
    expect(r[0].content).toContain("## 标题");
    expect(r[0].content).toContain("- b");
  });
});

describe("AI 输出格式容错", () => {
  it("```edit 与注释同行(缺换行)也能解析", () => {
    const r = extractEdits("```edit<!-- replace-heading: 章节 -->\n内容\n```");
    expect(r).toHaveLength(1);
    expect(r[0].replaceHeading).toBe("章节");
    expect(r[0].content).toBe("内容");
  });

  it("```edit 后带多余文字也能解析(注释仍有效,同行文字保留在内容里)", () => {
    const r = extractEdits("```edit 这里是修改说明\n<!-- at-end -->\n内容\n```");
    expect(r[0].atEnd).toBe(true);
    expect(r[0].content).toContain("内容");
    expect(r[0].content).toContain("这里是修改说明");
  });
});

describe("四反引号围栏(嵌套代码块)", () => {
  it("````edit 外层 + 内容含 ```mermaid 块,完整提取不截断", () => {
    const reply = [
      "说明文字",
      "",
      "````edit",
      "<!-- replace-heading: Mermaid -->",
      "## Mermaid",
      "",
      "```mermaid",
      "graph LR",
      "    A --> B",
      "```",
      "",
      "正文继续。",
      "````",
    ].join("\n");
    const r = extractEdits(reply);
    expect(r).toHaveLength(1);
    expect(r[0].replaceHeading).toBe("Mermaid");
    // 关键:内容里的 mermaid 块和后续正文都在,没有被 ``` 截断
    expect(r[0].content).toContain("graph LR");
    expect(r[0].content).toContain("正文继续。");
    expect(r[0].content).toContain("```mermaid");
  });

  it("三反引号老格式仍兼容", () => {
    const r = extractEdits("```edit\n<!-- at-end -->\n内容\n```");
    expect(r[0].content).toBe("内容");
  });

  it("用你上报的真实案例:嵌套 mermaid 导致的截断场景", () => {
    // AI 用三反引号包含 mermaid 的内容(错误格式),内容会在第一个 ``` 截断——
    // 这是已知限制;验证至少不崩溃,且截断部分仍可解析出定位
    const reply = "```edit\n<!-- replace-heading: 章节 -->\n## 章节\n\n```mermaid\ngraph LR\n  A-->B\n```\n\n后续文字\n```";
    const r = extractEdits(reply);
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].replaceHeading).toBe("章节");
  });
});
