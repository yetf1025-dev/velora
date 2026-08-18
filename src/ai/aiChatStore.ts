/**
 * AI 对话状态(跨面板开关持久保留,但不做本地持久化——会话是临时的)
 */
import { create } from "zustand";
import type { ChatMessage } from "../ai/aiService";
import { chatStream } from "../ai/aiService";
import { getEditor } from "../editor/editorController";

interface AiChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  /** 是否把当前文档作为上下文 */
  withDocument: boolean;
  /** 用户手动添加的上下文片段(右键“添加到对话”) */
  contexts: { id: number; text: string }[];

  setWithDocument: (v: boolean) => void;
  addContext: (text: string) => void;
  removeContext: (id: number) => void;
  clear: () => void;
  send: (text: string) => Promise<void>;
}

let contextSeq = 0;

const MAX_DOC_CONTEXT = 20000;

export const useAiChatStore = create<AiChatState>((set, get) => ({
  messages: [],
  loading: false,
  error: null,
  withDocument: false,
  contexts: [],

  setWithDocument: (withDocument) => set({ withDocument }),
  addContext: (text) =>
    set((s) => ({ contexts: [...s.contexts, { id: ++contextSeq, text }] })),
  removeContext: (id) =>
    set((s) => ({ contexts: s.contexts.filter((c) => c.id !== id) })),
  clear: () => set({ messages: [], error: null }),

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().loading) return;

    const history = [...get().messages, { role: "user" as const, content: trimmed }];
    set({ messages: history, loading: true, error: null });

    let system =
      "你是 Velora 文档编辑器内置的 AI 助手,帮助工程师撰写技术文档。" +
      "回答使用 Markdown 格式,简洁专业,可以使用代码块、表格和 Mermaid 图。";

    if (get().withDocument) {
      const doc = getEditor()?.getMarkdown() ?? "";
      if (doc.trim()) {
        const truncated =
          doc.length > MAX_DOC_CONTEXT
            ? doc.slice(0, MAX_DOC_CONTEXT) + "\n\n…(文档过长已截断)"
            : doc;
        system += `\n\n以下是用户当前正在编辑的文档内容:\n<document>\n${truncated}\n</document>`;
      }
    }

    // 用户手动添加的上下文片段(选中的文字等)
    const contexts = get().contexts;
    if (contexts.length > 0) {
      const blocks = contexts
        .map((c, i) => `<context_${i + 1}>\n${c.text}\n</context_${i + 1}>`)
        .join("\n");
      system += `\n\n用户提供的上下文片段:\n${blocks}`;
    }

    try {
      // 流式:先放空 assistant 气泡,逐 delta 追加,逐字渲染
      const historyWithEmpty = [...history, { role: "assistant" as const, content: "" }];
      set({ messages: historyWithEmpty });
      const reply = await chatStream(system, history, (delta) => {
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, content: last.content + delta };
          }
          return { messages: msgs };
        });
      });
      // 流可能末尾有非 SSE 文本没被回调捕获,补齐(用 reply 兜底)
      set((s) => {
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant" && last.content === "" && reply) {
          msgs[msgs.length - 1] = { role: "assistant", content: reply };
        }
        return { messages: msgs };
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },
}));
