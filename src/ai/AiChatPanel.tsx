import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { FileText, Loader2, SendHorizonal, Trash2 } from "lucide-react";
import { useAiChatStore } from "../ai/aiChatStore";

/** AI 对话面板:多轮对话,可选择附带当前文档作为上下文 */
export function AiChatPanel() {
  const {
    messages,
    loading,
    error,
    withDocument,
    contexts,
    setWithDocument,
    removeContext,
    clear,
    send,
  } = useAiChatStore();
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

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
        <label
          className="flex cursor-pointer items-center gap-1.5 text-[11px]"
          style={{ color: "var(--vl-text-muted)" }}
          title="把当前文档内容作为上下文发给 AI"
        >
          <input
            type="checkbox"
            checked={withDocument}
            onChange={(e) => setWithDocument(e.target.checked)}
            style={{ accentColor: "var(--vl-accent)" }}
          />
          <FileText size={11} />
          附带当前文档
        </label>
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
            勾选上方「附带当前文档」可让 AI 看到全文
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
  return (
    <div
      className="vl-chat-bubble-ai"
      // AI 返回的 markdown 经 marked 渲染;已做最小化净化(本地应用场景)
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
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
