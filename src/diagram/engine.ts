/**
 * Velora Diagram Engine v0
 * 统一入口:render(source, theme) → SVG 字符串。
 * 未来 Graphviz / PlantUML 等 Adapter 也挂在这里。
 */
import mermaid from "mermaid";
import { getDiagramTheme } from "./themes";

let renderSeq = 0;

export interface RenderResult {
  ok: boolean;
  svg?: string;
  error?: string;
}

export async function renderDiagram(
  source: string,
  themeId: string,
): Promise<RenderResult> {
  const theme = getDiagramTheme(themeId);
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: theme.variables,
      securityLevel: "strict",
      fontFamily: theme.variables.fontFamily,
    });
    renderSeq += 1;
    const { svg } = await mermaid.render(`vl-diagram-${renderSeq}`, source);
    return { ok: true, svg };
  } catch (err) {
    // mermaid 渲染失败时会在 DOM 里留下错误占位元素,清理掉
    document.getElementById(`dvl-diagram-${renderSeq}`)?.remove();
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
