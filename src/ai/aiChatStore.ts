/**
 * AI 对话状态(跨面板开关持久保留,但不做本地持久化——会话是临时的)
 */
import { create } from "zustand";
import type { ChatMessage } from "../ai/aiService";
import { chatStream } from "../ai/aiService";
import { extractEdits } from "../ai/aiEditParser";
import { getCleanMarkdownForAi, getPendingSuggestions, previewAiContent, previewReplaceHeading } from "../editor/editorController";
import { log } from "../platform/logService";

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
  withDocument: true,
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
    void log("info", `[AI 对话] 用户: ${trimmed.slice(0, 500)}`);

    let system =
      "你是 Velora 文档编辑器内置的 AI 助手,帮助工程师撰写技术文档。" +
      "回答使用 Markdown 格式,简洁专业,可以使用代码块、表格和 Mermaid 图。\n\n" +
      "重要协议:当你要修改或补充用户正在编辑的文档时,把要写入的内容放进 ```edit 代码块," +
      "第一行用注释标明位置:\n" +
      '- <!-- after-heading: 章节标题文字 -->  插到该章节末尾\n' +
      "- <!-- replace-heading: 章节标题文字 --> 替换该章节内容\n" +
      "- <!-- at-end -->  追加到文档末尾\n" +
      "不在 ```edit 块里的内容是解释说明,不会写入文档。用户可直接在编辑区预览并一键应用/拒绝。";

    if (get().withDocument) {
      // 干净原文:剥离未应用预览块(基线始终是原始文档,不受建议污染)
      const doc = getCleanMarkdownForAi();
      if (doc.trim()) {
        const truncated =
          doc.length > MAX_DOC_CONTEXT
            ? doc.slice(0, MAX_DOC_CONTEXT) + "\n\n…(文档过长已截断)"
            : doc;
        system += `\n\n以下是用户当前正在编辑的文档原文:\n<document>\n${truncated}\n</document>`;
      }
      // 上一轮 AI 建议(未应用):AI 结合它理解用户的修改意见演进
      const pending = getPendingSuggestions();
      if (pending.length > 0) {
        const blocks = pending
          .map((p, i) => `<pending_suggestion_${i + 1}>\n${p.content}\n</pending_suggestion_${i + 1}>`)
          .join("\n");
        system +=
          `\n\n以下是你上一轮提出的、尚未被用户应用的建议(用户当前看到的预览)。` +
          `用户的新意见通常针对这份建议,请基于原文 + 这份建议的改进来生成新的 edit 块:\n${blocks}`;
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

      void log("info", `[AI 对话] 回复(${reply.length} 字): ${reply.slice(0, 800)}`);
      // 自动就地预览:解析回复里的 ```edit 块,定位后插入预览
      const edits = extractEdits(reply);
      void log(
        "info",
        edits.length > 0
          ? `[AI 对话] 解析出 ${edits.length} 个 edit 块: ${edits.map(e => e.replaceHeading ? `replace(${e.replaceHeading})` : e.afterHeading ? `after(${e.afterHeading})` : "at-end/cursor").join(", ")}`
          : "[AI 对话] 回复中无 edit 块(未触发预览)",
      );
      for (const edit of edits) {
        if (edit.replaceHeading) {
          previewReplaceHeading(edit.content, edit.replaceHeading);
        } else {
          previewAiContent(edit.content, {
            afterHeading: edit.afterHeading,
            atEnd: edit.atEnd,
          });
        }
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },
}));
