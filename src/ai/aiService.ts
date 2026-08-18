/**
 * AI Service Layer —— Velora 的 AI 能力统一入口。
 * 支持 Anthropic 原生协议与 OpenAI 兼容协议(DeepSeek / GLM / Kimi 等),
 * 供应商细节对调用方透明。
 */
import { currentAiConfig } from "./aiStore";

export class AiError extends Error {}

export async function complete(system: string, user: string): Promise<string> {
  const config = currentAiConfig();
  if (!config.apiKey) {
    throw new AiError("尚未配置 API Key,请在 设置 → AI 中选择供应商并填写");
  }
  return config.format === "anthropic"
    ? completeAnthropic(config, system, user)
    : completeOpenAi(config, system, user);
}

interface ResolvedConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

/**
 * 拼接 API 端点。容忍用户在 Base URL 里多写或少写版本段:
 *   https://api.anthropic.com      + /v1/messages → https://api.anthropic.com/v1/messages
 *   https://api.anthropic.com/v1   + /v1/messages → 不重复 /v1
 *   …/v1/messages(已完整)                    → 原样使用
 */
function joinEndpoint(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (base.endsWith(path)) return base;
  const version = path.match(/^(\/v[\w.]+)\//);
  if (version && base.endsWith(version[1])) {
    return base + path.slice(version[1].length);
  }
  return base + path;
}

// ── 响应结构兼容层 ────────────────────────────────────────
// 各供应商返回结构有细微差异(content 字符串/数组、reasoning_content 等),
// 统一在这里兜底。

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

interface OpenAiResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      reasoning_content?: string;
    };
  }>;
  error?: { message?: string };
}

function extractAnthropicText(data: AnthropicResponse): string {
  return (data.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("");
}

function extractOpenAiText(data: OpenAiResponse): string {
  if (data.error?.message) {
    throw new AiError(`供应商返回错误:${data.error.message}`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c?.text)
      .map((c) => c.text)
      .join("");
  }
  return content ?? "";
}

async function completeAnthropic(
  config: ResolvedConfig,
  system: string,
  user: string,
): Promise<string> {
  const resp = await request(joinEndpoint(config.baseUrl, "/v1/messages"), {
    "x-api-key": config.apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  }, {
    model: config.model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = extractAnthropicText(resp as AnthropicResponse);
  if (!text) throw emptyContentError(resp);
  return text;
}

async function completeOpenAi(
  config: ResolvedConfig,
  system: string,
  user: string,
): Promise<string> {
  const resp = await request(joinEndpoint(config.baseUrl, "/chat/completions"), {
    Authorization: `Bearer ${config.apiKey}`,
  }, {
    model: config.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text = extractOpenAiText(resp as OpenAiResponse);
  if (!text) throw emptyContentError(resp);
  return text;
}

/** 空内容报错时带上响应片段,便于诊断供应商差异 */
function emptyContentError(data: unknown): AiError {
  let snippet = "";
  try {
    snippet = JSON.stringify(data).slice(0, 300);
  } catch {
    snippet = String(data).slice(0, 300);
  }
  return new AiError(`AI 返回了空内容。响应片段:${snippet}`);
}

async function request(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  // 桌面端走 Rust HTTP 代理:没有 CORS 限制,Key 不经过 WebView 网络层。
  // 浏览器开发模式(pnpm dev)回退到 fetch。
  if ("__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    let text: string;
    try {
      text = await invoke<string>("http_request", {
        url,
        headers,
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new AiError(String(e));
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new AiError(`响应不是合法 JSON:${text.slice(0, 200)}`);
    }
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new AiError(`网络请求失败(${url}):${String(e)}`);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new AiError(`API 错误 ${resp.status}(${url}):${text.slice(0, 200)}`);
  }
  return resp.json();
}

// ── 多轮对话 ──────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** 多轮对话:messages 为完整历史,system 为系统提示 */
export async function chat(
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  const config = currentAiConfig();
  if (!config.apiKey) {
    throw new AiError("尚未配置 API Key,请在 设置 → AI 中选择供应商并填写");
  }
  if (config.format === "anthropic") {
    const data = (await request(
      joinEndpoint(config.baseUrl, "/v1/messages"),
      {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      {
        model: config.model,
        max_tokens: 4096,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
    )) as AnthropicResponse;
    const text = extractAnthropicText(data);
    if (!text) throw emptyContentError(data);
    return text;
  }
  const data = (await request(
    joinEndpoint(config.baseUrl, "/chat/completions"),
    { Authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    },
  )) as OpenAiResponse;
  const text = extractOpenAiText(data);
  if (!text) throw emptyContentError(data);
  return text;
}

// ── 场景化 Prompt ─────────────────────────────────────────

export type TextAiAction = "polish" | "translate" | "summarize" | "expand";

export const TEXT_ACTION_LABELS: Record<TextAiAction, string> = {
  polish: "优化",
  translate: "翻译",
  summarize: "总结",
  expand: "扩写",
};

export async function aiOnText(
  action: TextAiAction,
  text: string,
): Promise<string> {
  const instructions: Record<TextAiAction, string> = {
    polish: "在不改变原意的前提下优化这段文字,使其更清晰、专业、流畅。保持原有的 Markdown 格式。",
    translate: "将这段文字翻译为另一种语言(中文→英文,英文→中文,其他语言→中文)。保持 Markdown 格式。",
    summarize: "将这段文字总结为更精炼的版本,保留关键信息。",
    expand: "对这段文字进行合理扩写,补充细节与论证,保持风格一致。",
  };
  return complete(
    `你是 Velora 文档编辑器的写作助手。${instructions[action]}只输出处理后的文本本身,不要解释,不要加引号或前后缀。`,
    text,
  );
}

/** Mermaid 图优化:返回纯 mermaid 源码 */
export async function aiOnMermaid(
  source: string,
  instruction: string,
): Promise<string> {
  const result = await complete(
    `你是 Mermaid 图表专家。根据用户指令修改给定的 Mermaid 源码。
规则:
- 只输出合法的 Mermaid 源码,不要任何解释或 markdown 围栏
- 保持图的语义正确,优先保证语法可被 mermaid 11 解析
- 节点文本如有中文保持中文`,
    `当前 Mermaid 源码:\n${source}\n\n指令:${instruction}`,
  );
  // 模型可能仍带了围栏,剥掉
  return result
    .replace(/^```(?:mermaid)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

/** SVG 修改:返回纯 SVG 源码 */
export async function aiOnSvg(
  source: string,
  instruction: string,
): Promise<string> {
  const result = await complete(
    `你是 SVG 图形排版专家。根据用户指令修改给定的 SVG 源码。

修改原则(按优先级):
1. **可读性优先**:如果元素过于紧凑,主动拉开间距——节点之间至少留出 24-40px 呼吸空间
2. **箭头/连线要舒展**:箭头被压短时,加长连接线的起点/终点坐标,让箭头完整显示且不与节点边缘重叠
3. **文字不裁切**:确保 text 元素有足够空间,必要时调整 x/y 或扩大容器
4. **同步扩大 viewBox / width / height**:拉开间距后画布必须相应放大,不要让元素出界
5. 保持原有结构、id、语义不变;配色修改时保持视觉一致性

输出规则:
- 只输出合法的 SVG 源码(以 <svg 开头),不要任何解释或 markdown 围栏`,
    `当前 SVG 源码:\n${source}\n\n指令:${instruction}`,
  );
  return result
    .replace(/^```(?:svg|xml|html)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

/** Mermaid → SVG:理解图的语义后重新绘制一张排版精良的 SVG */
export async function aiMermaidToSvg(
  mermaidSource: string,
  colorMode: "light" | "dark",
): Promise<string> {
  const result = await complete(
    `你是资深技术图解设计师。理解给定的 Mermaid 图的语义,从零手绘一张高质量 SVG。

排版要求:
- 充分理解节点语义与层级关系,合理分区/分组,同类节点对齐
- 节点间距充足(至少 32-48px),箭头/连线舒展,不压节点边缘
- 文字完整不裁切,字号 13-14px,字体用系统栈(-apple-system, sans-serif)
- 箭头用 marker 定义,连线避免交叉;长标签合理换行
- 配色:专业克制,语义化分组配色,适合${colorMode === "dark" ? "暗色" : "亮色"}背景
- 根元素必须带正确的 viewBox,尺寸按内容计算,四周留白 24px

输出规则:
- 只输出 SVG 源码(以 <svg 开头),不要任何解释或 markdown 围栏
- 不引用外部资源(字体/图片/CSS),自包含`,
    `Mermaid 源码:\n${mermaidSource}`,
  );
  return result
    .replace(/^```(?:svg|xml|html)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

// ── 流式输出(SSE)──────────────────────────────────────────
// 经 Rust http_stream 命令逐块读响应,前端解析 SSE 增量。
// Anthropic: content_block_delta.delta.text
// OpenAI:    choices[0].delta.content

/** 从一段 SSE 文本里提取本次增量文本(跨协议) */
function extractDelta(chunk: string, format: "anthropic" | "openai"): string {
  let out = "";
  // SSE 事件以空行分隔,每行 "data: {...}"
  for (const line of chunk.split("\n")) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]" || payload === "") continue;
    try {
      const evt = JSON.parse(payload);
      if (format === "anthropic") {
        if (evt.type === "content_block_delta" && evt.delta?.text) {
          out += evt.delta.text;
        }
      } else {
        const delta = evt.choices?.[0]?.delta?.content;
        if (typeof delta === "string") out += delta;
      }
    } catch {
      // 非 JSON 行或半截,跳过(下次 chunk 会补全)
    }
  }
  return out;
}

/** 流式请求:逐字回调 onDelta,返回完整文本 */
async function requestStream(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  format: "anthropic" | "openai",
  onDelta: (delta: string) => void,
): Promise<string> {
  if (!("__TAURI_INTERNALS__" in window)) {
    // 浏览器 dev:fetch ReadableStream
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if (!resp.ok || !resp.body) {
      throw new AiError(`流式请求失败 ${resp.status}`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const delta = extractDelta(buf, format);
      if (delta) {
        full += delta;
        onDelta(delta);
        buf = "";
      }
    }
    return full;
  }

  // 桌面:Rust http_stream + Channel
  const { invoke, Channel } = await import("@tauri-apps/api/core");
  const channel = new Channel<typeof STREAM_CHUNK_TYPE>();
  let full = "";
  let buf = "";
  const done = new Promise<string>((resolve) => {
    channel.onmessage = (msg) => {
      if (msg.type === "done") {
        resolve(full);
      } else {
        buf += msg.text;
        const delta = extractDelta(buf, format);
        if (delta) {
          full += delta;
          onDelta(delta);
          buf = "";
        }
      }
    };
  });
  await invoke("http_stream", {
    url,
    headers,
    body: JSON.stringify(body),
    onChunk: channel,
  });
  return done;
}

// Channel 消息类型(与 Rust StreamChunk 对应)
const STREAM_CHUNK_TYPE = {} as { type: "data"; text: string } | { type: "done" };

/** 流式对话:onDelta 逐字回调,返回完整文本 */
export async function chatStream(
  system: string,
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
): Promise<string> {
  const config = currentAiConfig();
  if (!config.apiKey) {
    throw new AiError("尚未配置 API Key,请在 设置 → AI 中选择供应商并填写");
  }
  if (config.format === "anthropic") {
    return requestStream(
      joinEndpoint(config.baseUrl, "/v1/messages"),
      {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      {
        model: config.model,
        max_tokens: 4096,
        stream: true,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      "anthropic",
      onDelta,
    );
  }
  return requestStream(
    joinEndpoint(config.baseUrl, "/chat/completions"),
    { Authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      stream: true,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    },
    "openai",
    onDelta,
  );
}
