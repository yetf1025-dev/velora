/**
 * HtmlNode —— Markdown 里的原生 HTML 块(fallback 渲染)。
 *
 * marked 会把多行 HTML 拆成 html token;@tiptap/markdown 的 schema 解析只认
 * 已注册扩展的标签,其余(<p style>、<font>、<center> 等前端写法)整体转成
 * 字面文本——用户看到的是源码而非渲染效果。
 *
 * 本扩展在 tokenizer 层把「schema 不支持的 HTML 块」拦截为 htmlBlock 节点:
 *   - attrs.html 存原文,序列化原样回写,内容零丢失
 *   - NodeView 经 DOMParser 净化后 DOM 注入渲染(shadow DOM 隔离排版样式)
 * 已被 schema 正常支持的 HTML(如 <b>、<em>)不会被本节点截获。
 */
import type {
  JSONContent,
  MarkdownParseResult,
  MarkdownToken,
} from "@tiptap/core";
import { Extension, Node } from "@tiptap/core";

export interface HtmlAttrs {
  /** 原始 HTML 片段 */
  html: string;
}

/**
 * 判定一段 HTML 是否含有 schema 支持的「有渲染语义的标签」。
 * 用于 tokenize 预判:纯内联标签构成的块交回给默认链路(schema 能直接消化),
 * 含块级/未识别标签的才值得做成 htmlBlock。
 */
const SCHEMA_TAGS =
  /^(?:a|abbr|b|blockquote|br|code|del|em|h[1-6]|hr|i|img|li|mark|ol|p|pre|s|strong|sub|sup|table|tbody|td|th|thead|tr|u|ul|svg)$/;

const VOID_TAGS = /^(?:hr|img|br|input|meta|link|area|base|col|embed|source|track|wbr)$/;

export function hasUnrecognizedHtmlTag(html: string): boolean {
  const tagRe = /<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].startsWith("</")) continue;
    const name = m[1].toLowerCase();
    // 自定义元素(连字符名)与未知标签 → 需要 fallback 渲染
    if (!SCHEMA_TAGS.test(name)) return true;
  }
  return false;
}

export const HtmlBlock = Node.create({
  name: "htmlBlock",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return { html: { default: "" } };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="html-block"]' }];
  },

  renderHTML() {
    return ["div", { "data-type": "html-block" }];
  },

  // ── Markdown 映射 ─────────────────────────────────────
  markdownTokenName: "htmlBlock",

  parseMarkdown(token: MarkdownToken): MarkdownParseResult {
    const raw = (token as unknown as { raw?: string }).raw ?? "";
    return {
      type: "htmlBlock",
      attrs: { html: raw.trim() } satisfies HtmlAttrs,
    };
  },

  renderMarkdown(node: JSONContent): string {
    return String((node.attrs as Record<string, unknown>).html ?? "");
  },
});

/**
 * htmlBlock 的 block tokenizer:
 * 捕获「行首 <tag」开头、含 schema 外标签、且能配对闭合的多行 HTML 块。
 * 先于 marked 内置 html / paragraph tokenizer 执行(svgBlock 同款思路)。
 */
export const HtmlBlockParser = Extension.create({
  name: "htmlBlockParser",
  // 与 SvgBlockParser 同级;见 tokenize:<svg> 必须让行给 svgBlock
  priority: 200,

  markdownTokenName: "htmlBlock",

  // 序列化注册表同 svgBlock 教训:'htmlBlock' 键由本扩展持有,
  // renderMarkdown 必须也挂这里,否则查表拿到无 render 能力的 spec 输出为空
  renderMarkdown(node: JSONContent): string {
    return String((node.attrs as Record<string, unknown>).html ?? "");
  },

  markdownTokenizer: {
    name: "htmlBlock",
    level: "block",
    start(src: string): number {
      return src.match(/^<[a-zA-Z][\s>]/m)?.index ?? -1;
    },
    tokenize(src: string) {
      const nl = src.indexOf("\n");
      const line = src.slice(0, nl === -1 ? src.length : nl);
      const openMatch = line.match(/^<([a-zA-Z][a-zA-Z0-9-]*)([\s>])/);
      if (!openMatch) return undefined;
      const tagName = openMatch[1];
      // <svg> 由 SvgBlockParser 专属认领(内联 SVG 是一等公民节点),放行
      if (/^svg$/i.test(tagName)) return undefined;
      // schema 直接支持且无属性(裸 <p>/<ul> 等)的块交给默认链路消化
      const attrsPart = line.slice(1 + tagName.length).trimEnd();
      const hasAttr = !/^>$/.test(attrsPart);
      if (SCHEMA_TAGS.test(tagName) && !hasAttr) return undefined;

      // 配对闭合:<tag ...> ... </tag>;嵌套同标签时要求开/闭计数平衡才吞,
      // 不平衡(闭合还没出现)则放弃——避免吞掉未完成输入的半个块
      const pairRe = new RegExp(
        `^<${tagName}(\\s[^>]*)?>[\\s\\S]*?<\\/${tagName}\\s*>[ \\t]*(?=\\n|$)`,
        "i",
      );
      const m = src.match(pairRe);
      if (m) {
        const raw = m[0];
        const opens = raw.match(new RegExp(`<${tagName}(?=[\\s>])`, "gi"))?.length ?? 0;
        const closes = raw.match(new RegExp(`<\\/${tagName}>`, "gi"))?.length ?? 0;
        if (opens !== closes) return undefined;
        return { type: "htmlBlock", raw };
      }
      // void 标签单行块(<hr>、<img …>、<br>)
      const selfRe = new RegExp(`^<${tagName}[^>]*\\/?>[ \\t]*(?=\\n|$)`);
      const s = src.match(selfRe);
      if (s && VOID_TAGS.test(tagName)) {
        return { type: "htmlBlock", raw: s[0] };
      }
      return undefined;
    },
  },

  parseMarkdown(token: MarkdownToken): MarkdownParseResult {
    const raw = (token as unknown as { raw?: string }).raw ?? "";
    return {
      type: "htmlBlock",
      attrs: { html: raw.trim() } satisfies HtmlAttrs,
    };
  },
});
