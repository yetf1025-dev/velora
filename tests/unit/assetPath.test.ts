/** resolveRelative/parentDir:相对文档路径解析(Windows 反斜杠/盘符回归) */
import { describe, expect, it } from "vitest";
import { resolveRelative, parentDir } from "../../src/platform/assetPath";

describe("resolveRelative", () => {
  it("POSIX 文档路径 + 相对引用(旧行为不变)", () => {
    expect(resolveRelative("/home/u/docs/design.md", "figures/fig0.svg")).toBe(
      "/home/u/docs/figures/fig0.svg",
    );
  });

  it("Windows 反斜杠文档路径(事故形态:旧版切出截断乱路径)", () => {
    expect(
      resolveRelative("D:\\code\\doc\\mgr-performance\\design.md", "figures/fig0-orth.svg"),
    ).toBe("D:/code/doc/mgr-performance/figures/fig0-orth.svg");
  });

  it(".. 回退跨目录(含反斜杠引用)", () => {
    expect(
      resolveRelative("D:\\code\\doc\\mgr-performance\\design.md", "..\\..\\icons\\32x32.png"),
    ).toBe("D:/code/icons/32x32.png");
  });

  it("绝对引用原样规范化:POSIX 与盘符", () => {
    expect(resolveRelative("/a/b.md", "/etc/x.svg")).toBe("/etc/x.svg");
    expect(resolveRelative("D:\\a\\b.md", "E:/pics/c.svg")).toBe("E:/pics/c.svg");
    expect(resolveRelative("D:\\a\\b.md", "E:\\pics\\c.svg")).toBe("E:/pics/c.svg");
  });

  it("./ 与重复斜杠折叠", () => {
    expect(resolveRelative("D:/a/b/c.md", "./d//e.svg")).toBe("D:/a/b/d/e.svg");
  });
});

describe("parentDir", () => {
  it("POSIX 路径取父目录", () => {
    expect(parentDir("/home/u/docs/design.md")).toBe("/home/u/docs");
  });

  it("Windows 反斜杠路径取父目录(拖拽自动挂载项目根用)", () => {
    expect(parentDir("D:\\code\\doc\\design.md")).toBe("D:/code/doc");
  });

  it("裸文件名 / 根路径返回 null", () => {
    expect(parentDir("design.md")).toBeNull();
    expect(parentDir("/design.md")).toBeNull();
  });
});
