import { describe, expect, it } from "vitest";
import {
  hasUnrecognizedHtmlTag,
  isEscapedHtmlBlock,
  decodeEscapedHtml,
} from "../../src/editor/extensions/htmlblock/HtmlNode";
import {
  sanitizeHtmlFragment,
  resolveRenderableHtml,
} from "../../src/editor/extensions/htmlblock/HtmlBlockView";

/** tokenizer 预判:含 schema 外标签的 HTML 才需要 htmlBlock fallback */
describe("hasUnrecognizedHtmlTag", () => {
  it("用户案例:<p style>+<font> → 需要 fallback", () => {
    expect(
      hasUnrecognizedHtmlTag(`<p style="text-align:center; font-weight:bold;">\n<font size=10>\n标题\n</font>\n</p>`),
    ).toBe(true);
  });

  it("纯 schema 内标签 → 不需要(默认链路可消化)", () => {
    expect(hasUnrecognizedHtmlTag("<p>hello <b>world</b></p>")).toBe(false);
    expect(hasUnrecognizedHtmlTag("<h2 id=x>标题</h2>")).toBe(false);
  });

  it("自定义元素与未知标签 → 需要", () => {
    expect(hasUnrecognizedHtmlTag("<my-widget>x</my-widget>")).toBe(true);
    expect(hasUnrecognizedHtmlTag("<center>x</center>")).toBe(true);
    expect(hasUnrecognizedHtmlTag("<font size=3>x</font>")).toBe(true);
  });
});

/** 净化:危险内容剔除后才能进 shadow DOM */
describe("sanitizeHtmlFragment", () => {
  it("剥离 script(含子树)", () => {
    const out = sanitizeHtmlFragment('<p>a</p><script>alert(1)</script><p>b</p>');
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>a</p>");
  });

  it("剥离 iframe/object/embed/link/meta/form", () => {
    const out = sanitizeHtmlFragment(
      '<iframe src="x"></iframe><object data="y"></object><embed src="z"><link href="l"><meta charset="utf-8"><form action="/p"><input></form><p>k</p>',
    );
    for (const tag of ["iframe", "object", "embed", "link", "meta", "form", "input"]) {
      expect(out).not.toContain(tag);
    }
    expect(out).toContain("<p>k</p>");
  });

  it("剥离 on* 事件属性与 javascript: URL", () => {
    const out = sanitizeHtmlFragment(
      '<a href="javascript:alert(1)" onclick="evil()" title="t">链接</a>',
    );
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("javascript:");
    expect(out).toContain('title="t"'); // 正常属性保留
  });

  it("正常样式标签原样保留(用户核心诉求)", () => {
    const src = '<p style="text-align: center; font-weight: bold;"><font size="10">标题</font></p>';
    const out = sanitizeHtmlFragment(src);
    expect(out).toContain('style="text-align: center; font-weight: bold;"');
    expect(out).toContain("<font");
    expect(out).toContain("标题");
  });
});

/** 二次转义形态(AI 生成/网页复制):&lt;p&gt;…&lt;/p&gt; 解码后可渲染 */
describe("escaped html block", () => {
  it("识别转义 HTML 块", () => {
    expect(
      isEscapedHtmlBlock('&lt;p style="text-align:center;"&gt;\n&lt;font size=10&gt;\n标题\n&lt;/font&gt;\n&lt;/p&gt;'),
    ).toBe(true);
    // 非 HTML 的普通实体(数学、箭头)不算
    expect(isEscapedHtmlBlock("1 &lt; 2 &amp;&amp; 3 &gt; 2")).toBe(false);
  });

  it("解码还原真实 HTML", () => {
    expect(decodeEscapedHtml("&lt;p style=&quot;a&quot;&gt;x&lt;/p&gt;")).toBe('<p style="a">x</p>');
  });

  it("resolveRenderableHtml:转义块解码、原生块原样", () => {
    const esc = "&lt;font size=10&gt;标题&lt;/font&gt;";
    expect(resolveRenderableHtml(esc)).toBe("<font size=10>标题</font>");
    const native = '<p style="color:red">x</p>';
    expect(resolveRenderableHtml(native)).toBe(native);
  });

  it("解码后的转义块经净化仍保留样式(端到端形态)", () => {
    const esc =
      '&lt;p style="text-align:center; font-weight:bold;"&gt;\n&lt;font size=10&gt;\nLC RGW 删除/转移优先级调度特性设计文档\n&lt;/font&gt;\n&lt;/p&gt;';
    const out = sanitizeHtmlFragment(resolveRenderableHtml(esc));
    expect(out).toContain("text-align:center");
    expect(out).toContain("size=\"10\"");
    expect(out).toContain("LC RGW 删除/转移优先级调度特性设计文档");
  });
});
