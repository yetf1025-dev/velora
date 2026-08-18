import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { getEditor } from "../editor/editorController";

/**
 * 节点源码卡片:显示当前选中块的 Markdown 源码。
 * 利用 MarkdownManager 对单节点序列化,所见即所得。
 */
export function NodeSourceCard({ pos }: { pos: number }) {
  const editor = getEditor();
  const [source, setSource] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const compute = () => {
      // 文档变更后旧 pos 可能越界(AI 替换等),先查边界
      const docSize = editor.state.doc.content.size;
      if (pos < 0 || pos > docSize) {
        setSource("");
        return;
      }
      const node = editor.state.doc.nodeAt(pos);
      if (!node) {
        setSource("");
        return;
      }
      try {
        // editor.markdown 属性不可靠,用 storage.markdown.manager
        const manager = editor.storage.markdown?.manager;
        if (!manager) {
          setSource("");
          return;
        }
        const md = manager.renderNodeToMarkdown(
          node.toJSON(),
          undefined,
          0,
          0,
        );
        setSource((md ?? "").trim());
      } catch {
        setSource("");
      }
    };
    compute();
    editor.on("transaction", compute);
    return () => {
      editor.off("transaction", compute);
    };
  }, [editor, pos]);

  if (!source) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="border-t p-3"
      style={{ borderColor: "var(--vl-border)" }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="text-xs font-medium"
          style={{ color: "var(--vl-text-muted)" }}
        >
          源码
        </span>
        <button
          type="button"
          className="rounded p-1 transition-colors hover:bg-[var(--vl-panel-active)]"
          style={{ color: "var(--vl-text-muted)" }}
          onClick={() => void copy()}
          title="复制源码"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <pre
        className="max-h-48 overflow-auto rounded-md p-2 text-[11px] leading-relaxed"
        style={{
          background: "var(--vl-code-bg)",
          color: "var(--vl-code-text)",
          fontFamily: "var(--vl-font-mono)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {source}
      </pre>
    </div>
  );
}
