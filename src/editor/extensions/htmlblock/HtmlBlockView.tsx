/**
 * htmlBlock NodeView:把 attrs.html 净化后注入内部 shadow host 渲染。
 *
 * - shadow 宿主是 wrapper 内层的普通 div,不是 PM content 元素本身
 *   (contenteditable 管理的元素 attachShadow 会抛 NotSupportedError)
 * - closed shadow:文档排版主题(编辑器 CSS)不会渗入,HTML 以浏览器
 *   默认 UA 样式渲染
 * - 净化:剥离 script/iframe/object/embed/link/meta、on* 属性与
 *   javascript: URL;SVG 已被 SvgBlockParser 先行认领,一般到不了本节点
 */
import { useEffect, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { decodeEscapedHtml, isEscapedHtmlBlock } from "./HtmlNode";

/** 危险元素:整棵子树剔除 */
const DANGEROUS_TAGS =
  "script,iframe,object,embed,link,meta,base,form,noscript,template";

export function sanitizeHtmlFragment(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll(DANGEROUS_TAGS).forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (
        (name === "href" || name === "src" || name === "xlink:href") &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

/** attrs.html → 可渲染 HTML:整段实体转义的先解码(AI 生成/网页复制的二次转义) */
export function resolveRenderableHtml(raw: string): string {
  return isEscapedHtmlBlock(raw) ? decodeEscapedHtml(raw) : raw;
}

export function HtmlBlockView({ node }: NodeViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const html = String(node.attrs.html ?? "");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // closed 的 shadowRoot 属性恒为 null:root 必须缓存在 ref,
    // 否则严格模式二次挂载会对同一元素重复 attachShadow
    // (Chromium 静默,WebKit 抛 NotSupportedError)
    let root = shadowRef.current;
    if (!root || root.host !== host) {
      root = host.attachShadow({ mode: "closed" });
      shadowRef.current = root;
    }
    root.innerHTML = sanitizeHtmlFragment(resolveRenderableHtml(html));
    return () => {
      root.innerHTML = "";
    };
  }, [html]);

  return (
    <NodeViewWrapper data-type="html-block" className="vl-htmlblock">
      {/* shadow 宿主必须是普通 div;wrapper 本身由 PM 接管不能 attachShadow */}
      <div ref={hostRef} className="vl-htmlblock-shadow-host" />
    </NodeViewWrapper>
  );
}
