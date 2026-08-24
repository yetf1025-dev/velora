import { describe, expect, it } from "vitest";
import { sizeSvgHtml } from "../../src/components/SvgZoomOverlay";

/**
 * sizeSvgHtml:注入放大查看器前,按 viewBox 给 <svg> 落定显式 px 尺寸。
 * 覆盖三类来源:mermaid 输出 / 文件型 SVG(XML 声明、前置注释)/ 画布序列化。
 */
describe("sizeSvgHtml", () => {
  it("mermaid 形态:width=100% 被替换为 viewBox 的 px 尺寸", () => {
    const out = sizeSvgHtml(
      `<svg aria-roledescription="flowchart-v2" viewBox="0 0 1094 1213" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-width: 1094px;" height="100%"><g/></svg>`,
    );
    expect(out).toContain('<svg width="1094px" height="1213px"');
    expect(out).not.toContain('width="100%"');
    expect(out).toContain('viewBox="0 0 1094 1213"');
  });

  it("XML 声明 prolog:属性落在 <svg> 开标签上,而非插进 <?xml?>", () => {
    const out = sizeSvgHtml(
      `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><g/></svg>`,
    );
    expect(out).toMatch(/<svg width="100px" height="50px"[^>]*>/);
    expect(out.startsWith(`<?xml version="1.0" encoding="UTF-8"?>`)).toBe(true);
  });

  it("前置注释:改写不破坏注释闭合,innerHTML 后 svg 仍在", () => {
    const out = sizeSvgHtml(
      `<!-- generated -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="10" height="10"/></svg>`,
    );
    const host = document.createElement("div");
    host.innerHTML = out;
    expect(host.querySelector("svg")).not.toBeNull();
    expect(out).toContain('width="100px"');
  });

  it("已有显式宽高的画布 SVG:按 viewBox 重写(两引擎一致的口径)", () => {
    const out = sizeSvgHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 400 300"><g/></svg>`,
    );
    expect(out).toContain('width="400px"');
    expect(out).toContain('height="300px"');
    expect(out).not.toContain('width="800"');
  });

  it("viewBox 用逗号分隔 / 无 viewBox / viewBox 宽高为 0:原样返回", () => {
    const comma = `<svg viewBox="0,0,320,240"><g/></svg>`;
    expect(sizeSvgHtml(comma)).toContain('width="320px"');
    expect(sizeSvgHtml(`<svg width="10"><g/></svg>`)).toBe(`<svg width="10"><g/></svg>`);
    expect(sizeSvgHtml(`<svg viewBox="0 0 0 0"><g/></svg>`)).toBe(
      `<svg viewBox="0 0 0 0"><g/></svg>`,
    );
  });
});
