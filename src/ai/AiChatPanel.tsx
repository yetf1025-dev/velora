import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { FileText, Loader2, SendHorizonal, Trash2, Eye, Replace, Copy } from "lucide-react";
import { useAiChatStore } from "../ai/aiChatStore";
import { applyAiContent, getEditor, previewAiContent } from "../editor/editorController";

/** AI 对话面板:多轮对话,可选择附带当前文档作为上下文 */
export function AiChatPanel() {
  const {
    messages,
    loading,
    error,
    contexts,
    removeContext,
    clear,
    send,
  } = useAiChatStore();
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // e2e 调试:暴露对话 store
  useEffect(() => {
    (window as unknown as { __velora?: Record<string, unknown> }).__velora ??= {};
    (window as unknown as { __velora: Record<string, unknown> }).__velora.aiChat = useAiChatStore;
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading]);

  const submit = () => {
    if (!input.trim() || loading) return;
    const text = input;
    setInput("");
    void send(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--vl-border)" }}
      >
        <span
          className="flex items-center gap-1.5 text-[11px]"
          style={{ color: "var(--vl-text-faint)" }}
          title="AI 始终能看到你正在编辑的当前文档"
        >
          <FileText size={11} />
          已附带当前文档
        </span>
        <button
          type="button"
          className="rounded p-1 transition-colors hover:bg-[var(--vl-panel-active)]"
          style={{ color: "var(--vl-text-muted)" }}
          onClick={clear}
          title="清空对话"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div
            className="flex h-full items-center justify-center text-center text-xs leading-relaxed"
            style={{ color: "var(--vl-text-faint)" }}
          >
            问任何关于文档的问题
            <br />
            AI 可直接看到你正在编辑的当前文档
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)
        )}
        {loading && (
          <div
            className="flex items-center gap-1.5 py-2 text-xs"
            style={{ color: "var(--vl-text-muted)" }}
          >
            <Loader2 size={12} className="animate-spin" />
            思考中…
          </div>
        )}
        {error && (
          <div className="py-1 text-xs" style={{ color: "var(--vl-danger)" }}>
            {error}
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t p-2"
        style={{ borderColor: "var(--vl-border)" }}
      >
        {contexts.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {contexts.map((c) => (
              <span key={c.id} className="vl-chat-context-chip" title={c.text}>
                {c.text.length > 24 ? c.text.slice(0, 24) + "…" : c.text}
                <button
                  type="button"
                  className="vl-chat-context-remove"
                  onClick={() => removeContext(c.id)}
                  title="移除"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          className="vl-chat-input"
          placeholder="输入消息,⌘Enter 发送"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
        <button
          type="button"
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium"
          style={{
            background: "var(--vl-accent)",
            color: "#fff",
            opacity: input.trim() && !loading ? 1 : 0.45,
          }}
          disabled={!input.trim() || loading}
          onClick={submit}
        >
          <SendHorizonal size={12} />
          发送
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  if (role === "user") {
    return (
      <div className="vl-chat-bubble-user">
        {content}
      </div>
    );
  }
  return <AiBubble content={content} />;
}

/** AI 回复气泡:markdown 渲染 + 底部操作行(应用到编辑区) */
function AiBubble({ content }: { content: string }) {
  const [applied, setApplied] = useState<null | "insert" | "replace">(null);
  const editor = getEditor();
  const hasSelection = editor
    ? editor.state.selection.to > editor.state.selection.from
    : false;

  return (
    <div>
      <div
        className="vl-chat-bubble-ai"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
      {content.trim() && (
        <div className="vl-chat-actions">
          <button
            type="button"
            className="vl-chat-action-btn"
            title="在编辑区显示为高亮预览,可就地应用或拒绝"
            onClick={() => {
              if (previewAiContent(content)) setApplied("insert");
            }}
          >
            <Eye size={11} />
            {applied === "insert" ? "已预览" : "在编辑区预览"}
          </button>
          <button
            type="button"
            className="vl-chat-action-btn"
            title="直接替换当前选区(不预览)"
            disabled={!hasSelection}
            onClick={() => {
              if (applyAiContent(content, "replace")) setApplied("replace");
            }}
          >
            <Replace size={11} />
            {applied === "replace" ? "已替换" : "替换选区"}
          </button>
          <button
            type="button"
            className="vl-chat-action-btn"
            title="复制"
            onClick={() => void navigator.clipboard.writeText(content)}
          >
            <Copy size={11} /> 复制
          </button>
        </div>
      )}
    </div>
  );
}

function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false });
  // 最小化净化:去掉 script 与内联事件(本地应用 + 自有 API 场景)
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}
