import { describe, expect, it } from "vitest";
import { searchInFiles, snippetAround } from "../../src/project/searchEngine";

describe("searchInFiles", () => {
  it("空 query 返回空", () => {
    expect(searchInFiles(new Map([["a.md", "hello"]]), "")).toEqual([]);
  });

  it("子串匹配,大小写不敏感,带行号列号", () => {
    const contents = new Map([
      ["a.md", "Hello world\nfoo Bar baz\nbar again"],
    ]);
    const r = searchInFiles(contents, "bar");
    expect(r).toHaveLength(1);
    expect(r[0].file).toBe("a.md");
    expect(r[0].matches).toEqual([
      { line: 2, col: 4, length: 3, text: "foo Bar baz" },
      { line: 3, col: 0, length: 3, text: "bar again" },
    ]);
  });

  it("按文件分组,匹配多的排前", () => {
    const contents = new Map([
      ["few.md", "x x"],
      ["many.md", "x x x x"],
    ]);
    const r = searchInFiles(contents, "x");
    expect(r[0].file).toBe("many.md");
    expect(r[1].file).toBe("few.md");
  });

  it("单文件匹配封顶 maxPerFile", () => {
    const contents = new Map([["a.md", Array(100).fill("hit").join("\n")]]);
    const r = searchInFiles(contents, "hit", 10);
    expect(r[0].matches.length).toBe(10);
  });

  it("无匹配文件不出现", () => {
    const contents = new Map([["a.md", "abc"], ["b.md", "xyz"]]);
    const r = searchInFiles(contents, "abc");
    expect(r.map((x) => x.file)).toEqual(["a.md"]);
  });
});

describe("snippetAround", () => {
  it("截取匹配周围,带省略号", () => {
    const text = "0123456789MATCHabcdefghij";
    const s = snippetAround(text, 10, 5, 4);
    expect(s.match).toBe("MATCH");
    expect(s.before.endsWith("6789")).toBe(true);
    expect(s.before.startsWith("…")).toBe(true);
    expect(s.after.startsWith("abcd")).toBe(true);
    expect(s.after.endsWith("…")).toBe(true);
  });

  it("行首/行尾不加省略号", () => {
    const s = snippetAround("MATCH rest", 0, 5, 40);
    expect(s.before).toBe("");
    expect(s.before.startsWith("…")).toBe(false);
  });
});
