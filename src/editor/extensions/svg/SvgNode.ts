/**
 * SvgNode —— SVG 是 Velora 的一等公民 Document Node(ADR-001)。
 *
 * 两种来源:
 *   1. 文件引用:![alt](diagram.svg)  → attrs.src,经平台层读源后内联渲染
 *   2. 内联 SVG:markdown 里的 <svg>...</svg> → attrs.source,直接渲染
 *
 * 一个扩展只能注册一个 markdownTokenName,因此:
 *   - image token 由 parseMarkdown 认领(.svg 后缀)
 *   - 内联 <svg> 由自定义 block tokenizer(marked 内置 html tokenizer 只认多行块,
 *     单行 <svg> 会被吞进段落,故自行拦截)
 */
import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownParseResult,
  MarkdownRendererHelpers,
  MarkdownToken,
  RenderContext,
} from "@tiptap/core";
import { Extension, Node } from "@tiptap/core";

export interface SvgAttrs {
  src: string | null;
  alt: string | null;
  source: string | null;
}

/** 运行时约定 null = 不认领,交给后续 handler(类型定义未包含 null) */
function decline(): MarkdownParseResult {
  return null as unknown as MarkdownParseResult;
}

/** svgBlock 节点 → markdown(序列化逻辑两处共享,见下方注释) */
function renderSvgMarkdown(node: JSONContent): string {
  const attrs = (node.attrs ?? {}) as Record<string, unknown>;
  if (attrs.source) return String(attrs.source);
  const src = (attrs.src as string) ?? "";
  const alt = (attrs.alt as string) ?? "";
  return `![${alt}](${src})`;
}

export const SvgNode = Node.create({
  name: "svgBlock",
  group: "block",
  atom: true,
  selectable: true,
  priority: 200,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      source: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="svg-block"]' }];
  },

  renderHTML() {
    return ["div", { "data-type": "svg-block" }];
  },

  // ── Markdown 映射 ──────────────────────────────────────
  markdownTokenName: "image",

  parseMarkdown(
    token: MarkdownToken,
    _helpers: MarkdownParseHelpers,
  ): MarkdownParseResult {
    // image token:仅认领 .svg 引用
    const href = (token as unknown as { href?: string }).href ?? "";
    if (!/\.svg(\?|#|$)/i.test(href)) return decline();
    return {
      type: "svgBlock",
      attrs: {
        src: href,
        alt: (token as unknown as { text?: string }).text ?? null,
        source: null,
      } satisfies SvgAttrs,
    };
  },

  renderMarkdown(
    node: JSONContent,
    _helpers: MarkdownRendererHelpers,
    _ctx: RenderContext,
  ): string {
    return renderSvgMarkdown(node);
  },
});

/**
 * 内联 <svg> 块的 tokenizer + 解析认领。
 * 与 SvgNode 拆开是因为一个扩展只能注册一个 markdownTokenName。
 * 自定义 block tokenizer 捕获行首 <svg>...</svg>(单行/多行均可),
 * 先于 marked 内置 html / paragraph tokenizer 执行。
 */
export const SvgBlockParser = Extension.create({
  name: "svgBlockParser",
  priority: 200,

  markdownTokenName: "svgBlock",

  parseMarkdown(
    token: MarkdownToken,
    _helpers: MarkdownParseHelpers,
  ): MarkdownParseResult {
    const raw = (token as unknown as { raw?: string }).raw ?? "";
    return {
      type: "svgBlock",
      attrs: { src: null, alt: null, source: raw.trim() } satisfies SvgAttrs,
    };
  },

  // 注意:序列化查找先查 token 注册表(getHandlerForToken),
  // 'svgBlock' 键由本扩展持有,因此 renderMarkdown 必须也挂在这里,
  // 否则会返回无 render 能力的 spec 导致输出为空。
  renderMarkdown(
    node: JSONContent,
    _helpers: MarkdownRendererHelpers,
    _ctx: RenderContext,
  ): string {
    return renderSvgMarkdown(node);
  },

  markdownTokenizer: {
    name: "svgBlock",
    level: "block",
    start(src: string): number {
      const match = src.match(/^<svg[\s>]/m);
      return match?.index ?? -1;
    },
    tokenize(src: string) {
      const match = src.match(/^<svg[\s\S]*?<\/svg>[ \t]*(\n|$)/);
      if (!match) return undefined;
      return {
        type: "svgBlock",
        raw: match[0],
      };
    },
  },
});
