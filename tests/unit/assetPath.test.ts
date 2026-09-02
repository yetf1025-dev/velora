/** resolveRelative:相对文档路径解析(Windows 反斜杠/盘符回归) */
import { describe, expect, it } from "vitest";
import { resolveRelative } from "../../src/platform/assetPath";

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
