/**
 * AI 供应商预设。
 * format 决定请求协议:anthropic = /v1/messages;openai = /v1/chat/completions 兼容协议。
 */
export interface ProviderPreset {
  id: string;
  label: string;
  format: "anthropic" | "openai";
  baseUrl: string;
  models: { id: string; label: string }[];
  defaultModel: string;
  /** API Key 获取入口提示 */
  keyHint: string;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    format: "anthropic",
    baseUrl: "https://api.anthropic.com",
    models: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
      { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
    ],
    defaultModel: "claude-sonnet-4-5",
    keyHint: "console.anthropic.com",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    format: "openai",
    baseUrl: "https://api.deepseek.com",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat (V3)" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)" },
    ],
    defaultModel: "deepseek-chat",
    keyHint: "platform.deepseek.com",
  },
  {
    id: "glm",
    label: "GLM Coding Plan",
    format: "anthropic",
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
    models: [
      { id: "glm-4.6", label: "GLM-4.6" },
      { id: "glm-4.5", label: "GLM-4.5" },
      { id: "glm-4.5-air", label: "GLM-4.5-Air" },
    ],
    defaultModel: "glm-4.6",
    keyHint: "bigmodel.cn Coding Plan(Anthropic 兼容端点)",
  },
  {
    id: "kimi",
    label: "Kimi",
    format: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    models: [
      { id: "kimi-k2-0905-preview", label: "Kimi K2" },
      { id: "kimi-k2-turbo-preview", label: "Kimi K2 Turbo" },
      { id: "moonshot-v1-8k", label: "Moonshot v1 8K" },
    ],
    defaultModel: "kimi-k2-0905-preview",
    keyHint: "platform.moonshot.cn",
  },
  {
    id: "custom-anthropic",
    label: "自定义(Anthropic 协议)",
    format: "anthropic",
    baseUrl: "",
    models: [],
    defaultModel: "",
    keyHint: "填写兼容 Anthropic /v1/messages 的端点",
  },
  {
    id: "custom-openai",
    label: "自定义(OpenAI 协议)",
    format: "openai",
    baseUrl: "",
    models: [],
    defaultModel: "",
    keyHint: "填写兼容 OpenAI /chat/completions 的端点",
  },
];

export function getProvider(id: string): ProviderPreset {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
