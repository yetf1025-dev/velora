/**
 * HTML 导出管线(MVP 简单版)。
 * 完整 Export Pipeline(PDF / DOCX / 与编辑器视觉一致)属 P1。
 *
 * Mermaid / SVG 节点导出为内联 SVG;其余节点经 generateHTML。
 */
import { generateHTML } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { veloraBaseExtensions } from "../editor/extensions";
import { resolveRelative } from "../platform/assetPath";
import { renderDiagram } from "../diagram/engine";
import { resolveThemeId } from "../diagram/themes";
import { readTextFile } from "../platform/fileService";
import katexCss from "katex/dist/katex.min.css?raw";

interface ExportOptions {
  theme: "light" | "dark";
  /** 当前文档路径,用于解析 SVG 相对引用;未保存的文档传 null */
  currentFilePath: string | null;
}

export async function buildHtmlDocument(
  doc: JSONContent,
  options: ExportOptions,
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
          : `<pre class="diagram-error">Mermaid 渲染失败:${escapeHtml(
              result.error ?? "",
            )}\n\n${escapeHtml(source)}</pre>`,
      );
      continue;
    }
    if (node.type === "svgBlock") {
      parts.push(`<figure class="svg">${await resolveSvg(node, options)}</figure>`);
      continue;
    }
    parts.push(generateHTML({ type: "doc", content: [node] }, extensions));
  }

  return `<!doctype html>
<html lang="zh-CN" data-theme="${options.theme}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Velora Export</title>
<style>${katexCss}</style>
<style>${EXPORT_CSS}</style>
</head>
<body>
<main class="velora-doc">
${parts.join("\n")}
</main>
</body>
</html>
`;
}

async function resolveSvg(
  node: JSONContent,
  options: ExportOptions,
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 导出用排版样式:与编辑器 Token 对齐的独立子集(不依赖 tokens.css 运行时) */
const EXPORT_CSS = `
:root {
  --vl-bg: #ffffff; --vl-text: #18181b; --vl-text-muted: #71717a;
  --vl-border: #e4e4e7; --vl-code-bg: #f4f4f5; --vl-accent-text: #4338ca;
}
[data-theme="dark"] {
  --vl-bg: #161618; --vl-text: #e4e4e7; --vl-text-muted: #a1a1aa;
  --vl-border: #2e2e33; --vl-code-bg: #202023; --vl-accent-text: #a5b4fc;
}
body { background: var(--vl-bg); color: var(--vl-text); margin: 0; }
.velora-doc {
  max-width: 760px; margin: 0 auto; padding: 48px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  font-size: 16px; line-height: 1.75;
}
h1 { font-size: 1.9em; border-bottom: 1px solid var(--vl-border); padding-bottom: .3em; }
h2 { font-size: 1.5em; }
pre { background: var(--vl-code-bg); padding: 14px 18px; border-radius: 10px; overflow-x: auto; }
code { font-family: "SF Mono", Menlo, monospace; font-size: .875em; background: var(--vl-code-bg); padding: .15em .35em; border-radius: 6px; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid var(--vl-border); margin: 1em 0; padding-left: 1em; color: var(--vl-text-muted); }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--vl-border); padding: 8px 12px; }
th { background: var(--vl-code-bg); }
a { color: var(--vl-accent-text); }
img { max-width: 100%; }
figure.diagram, figure.svg { display: flex; justify-content: center; margin: 1em 0; }
figure svg { max-width: 100%; height: auto; }
`;
