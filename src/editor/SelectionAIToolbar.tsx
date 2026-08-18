import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Check, Copy, Loader2, Replace, CornerDownRight, X, Wand2 } from "lucide-react";
import {
  aiOnText,
  complete,
  TEXT_ACTION_LABELS,
  type TextAiAction,
} from "../ai/aiService";

/**
 * 选中文字的 Context AI 工具栏。
 * 选中一段文字 → 优化/翻译/总结/扩写/自定义指令 → 结果可替换、插入下方或复制。
 */
export function SelectionAIToolbar({ editor }: { editor: Editor }) {
  const [loading, setLoading] = useState<TextAiAction | "custom" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [instruction, setInstruction] = useState("");

  const selectedText = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, "\n");
  };

  const run = async (action: TextAiAction) => {
    const text = selectedText();
    if (!text.trim()) return;
    setLoading(action);
    setError(null);
    setResult(null);
    try {
      setResult(await aiOnText(action, text));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const runCustom = async () => {
    const text = selectedText();
    if (!text.trim() || !instruction.trim()) return;
    setLoading("custom");
    setError(null);
    setResult(null);
    try {
      setResult(
        await complete(
          `你是 Velora 文档编辑器的写作助手。按照用户指令处理选中的文字,保持 Markdown 格式。只输出处理后的文本本身,不要解释。`,
          `选中的文字:\n${text}\n\n指令:${instruction.trim()}`,
        ),
      );
      setCustomMode(false);
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const replaceSelection = () => {
    if (!result) return;
    const { from, to } = editor.state.selection;
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, result, { contentType: "markdown" })
      .run();
    setResult(null);
  };

  const insertBelow = () => {
    if (!result) return;
    const { to } = editor.state.selection;
    editor
      .chain()
      .focus()
      .insertContentAt(to, `\n\n${result}\n\n`, { contentType: "markdown" })
      .run();
    setResult(null);
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor, state }) => {
        const { from, to } = state.selection;
        return editor.isEditable && to > from;
      }}
    >
      <div
        className="vl-ai-toolbar"
        // 关键:阻止 mousedown 默认行为,避免点击按钮时编辑器失焦 →
        // 选区塌缩 → BubbleMenu 隐藏 → 点击丢失(表现为“点了没反应”)
        onMouseDown={(e) => e.preventDefault()}
      >
        {loading !== null && (
          <div className="vl-ai-loading">
            <Loader2 size={12} className="animate-spin" />
            <span>
              AI 正在{loading === "custom" ? "执行自定义指令" : TEXT_ACTION_LABELS[loading]}
              ,请稍候…
            </span>
          </div>
        )}

        {loading === null && result === null && !error && !customMode && (
          <>
            {(Object.keys(TEXT_ACTION_LABELS) as TextAiAction[]).map(
              (action) => (
                <button
                  key={action}
                  type="button"
                  className="vl-ai-btn"
                  disabled={loading !== null}
                  onClick={() => void run(action)}
                >
                  {loading === action ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    TEXT_ACTION_LABELS[action]
                  )}
                </button>
              ),
            )}
            <button
              type="button"
              className="vl-ai-btn"
              disabled={loading !== null}
              title="自定义指令"
              onClick={() => setCustomMode(true)}
            >
              <Wand2 size={12} />
            </button>
          </>
        )}

        {customMode && loading === null && (
          <div className="flex items-center gap-1.5 p-1">
            <input
              autoFocus
              className="w-52 rounded border px-2 py-1 text-xs outline-none"
              style={{
                borderColor: "var(--vl-border)",
                background: "var(--vl-bg)",
                color: "var(--vl-text)",
              }}
              placeholder="对选中文字做什么?如:改成表格"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              // 输入框需要正常聚焦,不能阻止 mousedown 默认行为
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runCustom();
                if (e.key === "Escape") setCustomMode(false);
              }}
            />
            <button
              type="button"
              className="vl-ai-btn"
              disabled={loading !== null || !instruction.trim()}
              onClick={() => void runCustom()}
            >
              {loading === "custom" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                "执行"
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="vl-ai-result">
            <div className="vl-ai-error">{error}</div>
            <div className="vl-ai-actions">
              <button type="button" className="vl-ai-btn" onClick={() => setError(null)}>
                返回
              </button>
            </div>
          </div>
        )}

        {result !== null && (
          <div className="vl-ai-result">
            <div className="vl-ai-result-text">{result}</div>
            <div className="vl-ai-actions">
              <button type="button" className="vl-ai-btn" onClick={replaceSelection}>
                <Replace size={12} /> 替换
              </button>
              <button type="button" className="vl-ai-btn" onClick={insertBelow}>
                <CornerDownRight size={12} /> 插入下方
              </button>
              <button
                type="button"
                className="vl-ai-btn"
                onClick={() => {
                  void navigator.clipboard.writeText(result);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} 复制
              </button>
              <button
                type="button"
                className="vl-ai-btn"
                onClick={() => setResult(null)}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
