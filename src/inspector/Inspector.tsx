import { useAppStore } from "../state/appStore";
import { MermaidInspector } from "./MermaidInspector";
import { SvgInspector } from "./SvgInspector";
import { NodeSourceCard } from "./NodeSourceCard";

const KIND_LABELS: Record<string, string> = {
  paragraph: "段落",
  heading: "标题",
  blockquote: "引用",
  bulletList: "无序列表",
  orderedList: "有序列表",
  taskList: "任务列表",
  taskItem: "任务项",
  listItem: "列表项",
  table: "表格",
  mermaid: "Mermaid 图表",
  svgBlock: "SVG 图形",
  details: "折叠块",
  codeBlock: "代码块",
  toc: "目录",
  image: "图片",
};

/**
 * 上下文 Inspector:随光标/选区上下文切换面板。
 * 光标所在块或选中节点都会实时显示其 Markdown 源码。
 * bare 模式由 RightPanel 提供外层容器。
 */
export function Inspector({ bare = false }: { bare?: boolean }) {
  const ctx = useAppStore((s) => s.inspectorContext);

  const content = (
    <>
      <div
        className="border-b px-3 py-2 text-xs font-medium"
        style={{
          borderColor: "var(--vl-border)",
          color: "var(--vl-text-muted)",
        }}
      >
        {ctx ? (KIND_LABELS[ctx.kind] ?? ctx.kind) : "Inspector"}
      </div>
      <div className="flex-1 overflow-y-auto">
        {ctx?.kind === "mermaid" && <MermaidInspector pos={ctx.pos} />}
        {ctx?.kind === "svgBlock" && <SvgInspector pos={ctx.pos} />}
        {ctx && <NodeSourceCard pos={ctx.pos} />}
        {!ctx && (
          <div
            className="flex h-full items-center justify-center p-4 text-center text-xs"
            style={{ color: "var(--vl-text-faint)" }}
          >
            将光标移入文档任意位置
            <br />
            这里会显示当前块的源码
          </div>
        )}
      </div>
    </>
  );

  if (bare) {
    return <div className="flex min-h-0 flex-1 flex-col">{content}</div>;
  }
  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-l"
      style={{ borderColor: "var(--vl-border)", background: "var(--vl-panel)" }}
    >
      {content}
    </aside>
  );
}
