import { useEffect, useState } from "react";
import { Download, Sparkles, Loader2 } from "lucide-react";
import { diagramThemes, resolveThemeId } from "../diagram/themes";
import { renderDiagram } from "../diagram/engine";
import { exportTextFile } from "../platform/fileService";
import { getEditor } from "../editor/editorController";
import { aiOnMermaid } from "../ai/aiService";
import { usePendingAiStore } from "../ai/pendingAiStore";
import { useAppStore } from "../state/appStore";

/** Mermaid Inspector:光标/选区进入 Mermaid 节点时的上下文面板 */
export function MermaidInspector({ pos }: { pos: number }) {
  const appTheme = useAppStore((s) => s.theme);
  const [exporting, setExporting] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const editor = getEditor();

  // 订阅编辑器事务:主题切换等 dispatch 后需要重渲染以读取最新节点属性
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const bump = () => setVersion((v) => v + 1);
    editor.on("transaction", bump);
    return () => {
      editor.off("transaction", bump);
    };
  }, [editor]);

  const node = editor?.state.doc.nodeAt(pos);
  if (!editor || !node || node.type.name !== "mermaid") return null;

  const themeId = resolveThemeId(node.attrs.theme as string | null, appTheme);

  const updateTheme = (id: string) => {
    const { state, view } = editor;
    view.dispatch(
      state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, theme: id }),
    );
  };

  const exportSvg = async () => {
    setExporting(true);
    try {
      const result = await renderDiagram(node.attrs.source as string, themeId);
      if (result.ok && result.svg) {
        await exportTextFile("diagram.svg", result.svg);
      }
    } finally {
      setExporting(false);
    }
  };

  const runAi = async (instruction: string) => {
    if (!instruction.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const before = (node.attrs.source as string) ?? "";
      const newSource = await aiOnMermaid(before, instruction.trim());
      // ADR-004:不直接落库,放待应用 store 由 Diff 面板 Accept/Reject
      usePendingAiStore.getState().set({
        pos,
        kind: "Mermaid",
        attr: "source",
        before,
        after: newSource,
        apply: () => {
          const cur = editor.state.doc.nodeAt(pos);
          if (!cur) return;
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, undefined, {
              ...cur.attrs,
              source: newSource,
            }),
          );
        },
      });
      setAiInstruction("");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <div>
        <div
          className="mb-1.5 text-xs font-medium"
          style={{ color: "var(--vl-text-muted)" }}
        >
          图表类型
        </div>
        <div className="text-xs" style={{ color: "var(--vl-text)" }}>
          {detectDiagramType(node.attrs.source as string)}
        </div>
      </div>

      <div>
        <div
          className="mb-1.5 text-xs font-medium"
          style={{ color: "var(--vl-text-muted)" }}
        >
          主题
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {diagramThemes.map((t) => (
            <button
              key={t.id}
              type="button"
              className="rounded-md border px-2 py-1.5 text-xs transition-colors"
              style={{
                borderColor:
                  t.id === themeId ? "var(--vl-accent)" : "var(--vl-border)",
                background:
                  t.id === themeId ? "var(--vl-accent-soft)" : "transparent",
                color: "var(--vl-text)",
              }}
              onClick={() => updateTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors"
        style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
        onClick={() => void exportSvg()}
        disabled={exporting}
      >
        <Download size={12} />
        {exporting ? "导出中…" : "导出 SVG"}
      </button>

      {/* AI 优化:改 Mermaid 源码,不改 SVG */}
      <div
        className="border-t pt-3"
        style={{ borderColor: "var(--vl-border)" }}
      >
        <div
          className="mb-1.5 flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--vl-text-muted)" }}
        >
          <Sparkles size={12} />
          AI 优化图表
        </div>
        <div className="mb-1.5 flex gap-1.5">
          {["美化布局", "简化结构"].map((hint) => (
            <button
              key={hint}
              type="button"
              className="rounded-md border px-2 py-1 text-[11px] transition-colors"
              style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
              disabled={aiLoading}
              onClick={() => void runAi(hint)}
            >
              {hint}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs outline-none"
            style={{
              borderColor: "var(--vl-border)",
              background: "var(--vl-bg)",
              color: "var(--vl-text)",
            }}
            placeholder="如:把候选组改成橙色,增加回收路径"
            value={aiInstruction}
            disabled={aiLoading}
            onChange={(e) => setAiInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runAi(aiInstruction);
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium"
            style={{
              background: "var(--vl-accent)",
              color: "#fff",
              opacity: aiInstruction.trim() && !aiLoading ? 1 : 0.45,
            }}
            disabled={!aiInstruction.trim() || aiLoading}
            onClick={() => void runAi(aiInstruction)}
          >
            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : "执行"}
          </button>
        </div>
        {aiError && (
          <div className="mt-1.5 text-[11px]" style={{ color: "var(--vl-danger)" }}>
            {aiError}
          </div>
        )}
      </div>
    </div>
  );
}

function detectDiagramType(source: string): string {
  const first = source.trimStart().split("\n")[0]?.trim() ?? "";
  const map: Record<string, string> = {
    graph: "Flowchart",
    flowchart: "Flowchart",
    sequenceDiagram: "时序图",
    classDiagram: "类图",
    stateDiagram: "状态图",
    stateDiagram2: "状态图",
    erDiagram: "ER 图",
    gantt: "甘特图",
    pie: "饼图",
    mindmap: "思维导图",
    timeline: "时间线",
    gitGraph: "Git 图",
  };
  const key = Object.keys(map).find((k) => first.startsWith(k));
  return key ? map[key] : first || "未知";
}
