/**
 * 打印导出:生成打印优化的 HTML,写临时文件后用系统默认浏览器打开 →
 * 浏览器原生打印对话框(存为 PDF)。
 *
 * 这是 PDF 导出的务实方案:
 * - 原生打印质量(分页、字体、纸张尺寸、横纵由系统对话框提供)
 * - 复用 HTML 导出渲染管线,保证与编辑器视觉一致
 * - 不依赖 Tauri 隐藏窗口 print 的版本差异
 *
 * 后续可升级:Rust 侧 PDFKit / wkhtmltopdf 直接出文件。
 */
import { generateHTML } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { veloraBaseExtensions } from "../editor/extensions";
import { renderDiagram } from "../diagram/engine";
import { resolveThemeId } from "../diagram/themes";
import { readTextFile } from "../platform/fileService";
import katexCss from "katex/dist/katex.min.css?raw";

export interface PrintOptions {
  theme: "light" | "dark";
  currentFilePath: string | null;
  /** 纸张:A4 / Letter */
  paperSize: "A4" | "letter";
  /** 横向 / 纵向 */
  orientation: "portrait" | "landscape";
}

export async function buildPrintHtml(
  doc: JSONContent,
  options: PrintOptions,
): Promise<string> {
  const extensions = veloraBaseExtensions();
  const parts: string[] = [];

  for (const node of doc.content ?? []) {
    if (node.type === "mermaid") {
      const source = (node.attrs?.source as string) ?? "";
      const themeId = resolveThemeId(
        (node.attrs?.theme as string | null) ?? null,
        options.theme,
      );
      const result = await renderDiagram(source, themeId);
      parts.push(
        result.ok && result.svg
          ? `<figure class="diagram">${result.svg}</figure>`
          : `<pre class="diagram-error">Mermaid 渲染失败:${escapeHtml(result.error ?? "")}</pre>`,
      );
      continue;
    }
    if (node.type === "svgBlock") {
      parts.push(`<figure class="svg">${await resolveSvg(node, options)}</figure>`);
      continue;
    }
    parts.push(generateHTML({ type: "doc", content: [node] }, extensions));
  }

  const paper =
    options.paperSize === "A4" ? "A4" : "Letter";
  return `<!doctype html>
<html lang="zh-CN" data-theme="${options.theme}">
<head>
<meta charset="utf-8" />
<title>Velora Print</title>
<style>${katexCss}</style>
<style>${printCss(paper, options.orientation)}</style>
</head>
<body>
<main class="velora-doc">
${parts.join("\n")}
</main>
<script>
  // 等图渲染后自动弹打印对话框
  window.addEventListener("load", () => {
    setTimeout(() => window.print(), 300);
  });
</script>
</body>
</html>
`;
}

async function resolveSvg(
  node: JSONContent,
  options: PrintOptions,
): Promise<string> {
  const attrs = (node.attrs ?? {}) as Record<string, unknown>;
  if (attrs.source) return String(attrs.source);
  const src = (attrs.src as string) ?? "";
  if (src && options.currentFilePath) {
    try {
      return await readTextFile(resolveRelative(options.currentFilePath, src));
    } catch {
      return `<span class="svg-missing">SVG 文件缺失:${escapeHtml(src)}</span>`;
    }
  }
  return `<span class="svg-missing">SVG 文件缺失:${escapeHtml(src)}</span>`;
}

function resolveRelative(baseFile: string, rel: string): string {
  if (rel.startsWith("/")) return rel;
  const baseDir = baseFile.slice(0, baseFile.lastIndexOf("/"));
  const parts = (baseDir + "/" + rel).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return "/" + out.join("/");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 打印 CSS:分页、页边距、断点控制、避免元素被切两半 */
function printCss(paper: string, orientation: string): string {
  const size = orientation === "landscape" ? `${paper} landscape` : paper;
  return `
:root {
  --vl-bg: #ffffff; --vl-text: #18181b; --vl-text-muted: #71717a;
  --vl-border: #e4e4e7; --vl-code-bg: #f4f4f5; --vl-accent-text: #4338ca;
}
[data-theme="dark"] {
  --vl-bg: #161618; --vl-text: #e4e4e7; --vl-text-muted: #a1a1aa;
  --vl-border: #2e2e33; --vl-code-bg: #202023; --vl-accent-text: #a5b4fc;
}
* { box-sizing: border-box; }
body {
  background: var(--vl-bg); color: var(--vl-text); margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
}
.velora-doc {
  max-width: 760px; margin: 0 auto; padding: 24px;
  font-size: 14px; line-height: 1.7;
}
h1 { font-size: 1.8em; border-bottom: 1px solid var(--vl-border); padding-bottom: .3em; }
h2 { font-size: 1.45em; }
h3 { font-size: 1.2em; }
p { margin: .6em 0; }
a { color: var(--vl-accent-text); }
code {
  font-family: "SF Mono", Menlo, monospace; font-size: .875em;
  background: var(--vl-code-bg); padding: .15em .35em; border-radius: 4px;
}
pre {
  background: var(--vl-code-bg); padding: 12px 16px; border-radius: 8px;
  overflow-x: auto; font-size: 12.5px; line-height: 1.5;
  border: 1px solid var(--vl-border);
}
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid var(--vl-border); margin: 1em 0; padding-left: 1em; color: var(--vl-text-muted); }
table { border-collapse: collapse; width: 100%; font-size: .92em; }
th, td { border: 1px solid var(--vl-border); padding: 6px 10px; text-align: left; }
th { background: var(--vl-code-bg); font-weight: 600; }
img { max-width: 100%; }
figure.diagram, figure.svg { display: flex; justify-content: center; margin: 1em 0; }
figure svg { max-width: 100%; height: auto; }

@media print {
  @page { size: ${size}; margin: 18mm 16mm; }
  body { background: #fff; }
  /* 避免这些元素被分页切断 */
  h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
  pre, table, figure { break-inside: avoid; page-break-inside: avoid; }
  tr, img, svg { break-inside: avoid; page-break-inside: avoid; }
  /* 代码块过长允许横向滚动区域不被切 */
  pre { white-space: pre-wrap; word-break: break-all; }
}
@media screen {
  /* 屏幕预览时模拟 A4 页面,给用户打印前的直观感 */
  body { background: #525659; padding: 24px; }
  .velora-doc {
    background: var(--vl-bg); box-shadow: 0 2px 12px rgba(0,0,0,.3);
    min-height: 297mm; padding: 18mm 16mm;
  }
}
`;
}
