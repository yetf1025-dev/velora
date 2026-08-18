import { describe, expect, it } from "vitest";
import {
  collectMarkdownFiles,
  existsInTree,
  extractRefs,
  resolveRef,
  scanBrokenLinks,
} from "../../src/project/linkChecker";
import type { FileNode } from "../../src/state/appStore";

const tree: FileNode[] = [
  {
    name: "docs",
    path: "/proj/docs",
    isDir: true,
    children: [
      { name: "a.md", path: "/proj/docs/a.md", isDir: false, children: null },
      { name: "b.md", path: "/proj/docs/b.md", isDir: false, children: null },
    ],
  },
  { name: "c.md", path: "/proj/c.md", isDir: false, children: null },
];

describe("extractRefs", () => {
  it("提取链接和图片,跳过外部/锚点", () => {
    const refs = extractRefs([
      "[a](./docs/a.md) 正常链接",
      "![图](./x.png) 图片",
      "[外](https://e.com) 跳过",
      "[锚](#sec) 跳过",
    ].join("\n"));
    expect(refs).toEqual([
      { target: "./docs/a.md", kind: "link", line: 1 },
      { target: "./x.png", kind: "image", line: 2 },
    ]);
  });
});

describe("resolveRef", () => {
  it("相对路径基于源文件解析", () => {
    expect(resolveRef("/proj/docs/a.md", "./b.md")).toBe("/proj/docs/b.md");
    expect(resolveRef("/proj/docs/a.md", "../c.md")).toBe("/proj/c.md");
    expect(resolveRef("/proj/a.md", "/abs/x.md")).toBe("/abs/x.md");
  });
  it("锚点/查询剥离", () => {
    expect(resolveRef("/proj/a.md", "b.md#section")).toBe("/proj/b.md");
    expect(resolveRef("/proj/a.md", "b.md?v=1")).toBe("/proj/b.md");
  });
});

describe("existsInTree", () => {
  it("存在的文件返回 true", () => {
    expect(existsInTree("/proj", "/proj/docs/a.md", tree)).toBe(true);
    expect(existsInTree("/proj", "/proj/c.md", tree)).toBe(true);
  });
  it("不存在返回 false", () => {
    expect(existsInTree("/proj", "/proj/docs/missing.md", tree)).toBe(false);
    expect(existsInTree("/proj", "/proj/x.png", tree)).toBe(false);
  });
});

describe("scanBrokenLinks", () => {
  it("标记失效链接与缺失图片", () => {
    const contents = new Map<string, string>([
      ["/proj/docs/a.md", "[b](./b.md) [坏](./missing.md) ![](nope.png)"],
      ["/proj/docs/b.md", "[a](./a.md) 正常"],
    ]);
    const issues = scanBrokenLinks("/proj", tree, contents);
    expect(issues).toHaveLength(2);
    expect(issues[0].target).toBe("./missing.md");
    expect(issues[0].issue).toBe("broken");
    expect(issues[1].target).toBe("nope.png");
    expect(issues[1].issue).toBe("missing-image");
  });
});

describe("collectMarkdownFiles", () => {
  it("递归收集所有 md", () => {
    expect(collectMarkdownFiles(tree).sort()).toEqual([
      "/proj/c.md",
      "/proj/docs/a.md",
      "/proj/docs/b.md",
    ]);
  });
});
