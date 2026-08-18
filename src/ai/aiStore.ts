/**
 * AI 配置(ADR:AI 是独立 Service Layer,不混入编辑器层)。
 * 每个供应商独立记忆 API Key 与所选模型。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getProvider } from "./providers";

interface AiState {
  provider: string;
  /** providerId → apiKey */
  keys: Record<string, string>;
  /** providerId → modelId */
  models: Record<string, string>;
  /** providerId → baseUrl 覆盖(留空用预设) */
  baseUrlOverrides: Record<string, string>;

  setProvider: (id: string) => void;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setBaseUrlOverride: (url: string) => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      provider: "anthropic",
      keys: {},
      models: {},
      baseUrlOverrides: {},

      setProvider: (provider) => set({ provider }),
      setApiKey: (key) =>
        set((s) => ({ keys: { ...s.keys, [s.provider]: key } })),
      setModel: (model) =>
        set((s) => ({ models: { ...s.models, [s.provider]: model } })),
      setBaseUrlOverride: (url) =>
        set((s) => ({
          baseUrlOverrides: { ...s.baseUrlOverrides, [s.provider]: url },
        })),
    }),
    { name: "velora-ai" },
  ),
);

/** 当前生效的供应商配置快照 */
export function currentAiConfig(): {
  providerId: string;
  format: "anthropic" | "openai";
  apiKey: string;
  model: string;
  baseUrl: string;
} {
  const s = useAiStore.getState();
  const preset = getProvider(s.provider);
  return {
    providerId: preset.id,
    format: preset.format,
    apiKey: s.keys[preset.id] ?? "",
    model: s.models[preset.id] ?? preset.defaultModel,
    baseUrl: s.baseUrlOverrides[preset.id] || preset.baseUrl,
  };
}
