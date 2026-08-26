import { describe, expect, it } from "vitest";
import { pickDroppedMarkdown } from "../../src/platform/dragDrop";

/** 拖拽打开的文件挑选逻辑:只认 .md/.markdown(大小写不敏感),取第一个 */
describe("pickDroppedMarkdown", () => {
  it("单个 md 文件:打开它", () => {
    expect(pickDroppedMarkdown(["/Users/a/notes/hello.md"])).toEqual({
      file: "/Users/a/notes/hello.md",
      mdCount: 1,
      total: 1,
    });
  });

  it("混合文件:取第一个 md,忽略图片与其他类型", () => {
    expect(
      pickDroppedMarkdown(["/a/img.png", "/docs/readme.MARKDOWN", "/b/x.md", "/c/y.txt"]),
    ).toEqual({ file: "/docs/readme.MARKDOWN", mdCount: 2, total: 4 });
  });

  it("扩展名大小写不敏感", () => {
    expect(pickDroppedMarkdown(["/a/UPPER.MD"]).file).toBe("/a/UPPER.MD");
  });

  it("全非文档:file 为 null 但 total 计数,供调用方提示", () => {
    expect(pickDroppedMarkdown(["/a.png", "/b.pdf"])).toEqual({
      file: null,
      mdCount: 0,
      total: 2,
    });
  });

  it("空列表/空路径安全", () => {
    expect(pickDroppedMarkdown([])).toEqual({ file: null, mdCount: 0, total: 0 });
  });

  it("md 结尾的奇怪文件名不误判(如 .mdx / .md.bak)", () => {
    expect(pickDroppedMarkdown(["/a/note.mdx", "/b/note.md.bak"]).file).toBeNull();
  });
});
