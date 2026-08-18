import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { X } from "lucide-react";
import { complete } from "../ai/aiService";
import { useAiStore } from "../ai/aiStore";
import { getProvider, PROVIDERS } from "../ai/providers";
import { useAppStore } from "../state/appStore";
import { usePrefsStore } from "../settings/prefsStore";
import {
  comboFromEvent,
  SHORTCUT_LABELS,
  useShortcutStore,
  type ShortcutAction,
} from "../settings/shortcutService";

/**
 * 设置对话框(选项卡结构:通用 / AI / 快捷键)。
 * 新增设置类别时加一个 Tabs.Content 即可。
 */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="vl-dialog-overlay" />
        <Dialog.Content
          className="vl-dialog"
          style={{ width: 460 }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold">设置</Dialog.Title>
            <Dialog.Close className="vl-dialog-close">
              <X size={14} />
            </Dialog.Close>
          </div>

          <Tabs.Root defaultValue="general" className="mt-3">
            <Tabs.List className="vl-settings-tabs">
              <Tabs.Trigger value="general" className="vl-settings-tab">
                通用
              </Tabs.Trigger>
              <Tabs.Trigger value="ai" className="vl-settings-tab">
                AI
              </Tabs.Trigger>
              <Tabs.Trigger value="shortcuts" className="vl-settings-tab">
                快捷键
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="general">
              <GeneralTab />
            </Tabs.Content>
            <Tabs.Content value="ai">
              <AiTab />
            </Tabs.Content>
            <Tabs.Content value="shortcuts">
              <ShortcutsTab />
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── 通用 ──────────────────────────────────────────────────

function GeneralTab() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const autoSave = usePrefsStore((s) => s.autoSave);
  const setAutoSave = usePrefsStore((s) => s.setAutoSave);
  const autoSaveDelay = usePrefsStore((s) => s.autoSaveDelay);
  const setAutoSaveDelay = usePrefsStore((s) => s.setAutoSaveDelay);

  return (
    <div className="vl-settings-body">
      <div className="vl-settings-label">主题</div>
      <div className="flex gap-2">
        {(["light", "dark"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="rounded-md border px-3 py-1.5 text-xs transition-colors"
            style={{
              borderColor: theme === t ? "var(--vl-accent)" : "var(--vl-border)",
              background: theme === t ? "var(--vl-accent-soft)" : "transparent",
              color: "var(--vl-text)",
            }}
            onClick={() => setTheme(t)}
          >
            {t === "light" ? "亮色" : "暗色"}
          </button>
        ))}
      </div>

      <div className="vl-settings-label mt-4">保存</div>
      <label
        className="flex cursor-pointer items-center gap-2 text-xs"
        style={{ color: "var(--vl-text)" }}
      >
        <input
          type="checkbox"
          checked={autoSave}
          onChange={(e) => setAutoSave(e.target.checked)}
          style={{ accentColor: "var(--vl-accent)" }}
        />
        自动保存(停止输入后写入文件)
      </label>
      {autoSave && (
        <label
          className="mt-2 flex items-center gap-2 text-xs"
          style={{ color: "var(--vl-text-muted)" }}
        >
          停顿
          <select
            className="rounded border px-1.5 py-1 text-xs"
            style={{
              borderColor: "var(--vl-border)",
              background: "var(--vl-bg)",
              color: "var(--vl-text)",
            }}
            value={autoSaveDelay}
            onChange={(e) => setAutoSaveDelay(Number(e.target.value))}
          >
            <option value={500}>0.5 秒</option>
            <option value={800}>0.8 秒</option>
            <option value={1500}>1.5 秒</option>
            <option value={3000}>3 秒</option>
          </select>
          后自动保存
        </label>
      )}
      <p className="mt-2 text-[11px]" style={{ color: "var(--vl-text-faint)" }}>
        自动保存只对已经保存过的文件生效;新文档请先 ⌘S 选择保存位置。
      </p>
    </div>
  );
}

// ── AI ────────────────────────────────────────────────────

function AiTab() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const providerId = useAiStore((s) => s.provider);
  const setProvider = useAiStore((s) => s.setProvider);
  const keys = useAiStore((s) => s.keys);
  const models = useAiStore((s) => s.models);
  const setApiKey = useAiStore((s) => s.setApiKey);
  const setModel = useAiStore((s) => s.setModel);
  const baseUrlOverrides = useAiStore((s) => s.baseUrlOverrides);
  const setBaseUrlOverride = useAiStore((s) => s.setBaseUrlOverride);
  const preset = getProvider(providerId);
  const effectiveBaseUrl = baseUrlOverrides[preset.id] || preset.baseUrl;

  return (
    <div className="vl-settings-body">
      <div className="vl-settings-label">供应商</div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="rounded-md border px-2.5 py-1.5 text-xs transition-colors"
            style={{
              borderColor:
                providerId === p.id ? "var(--vl-accent)" : "var(--vl-border)",
              background:
                providerId === p.id ? "var(--vl-accent-soft)" : "transparent",
              color: "var(--vl-text)",
            }}
            onClick={() => setProvider(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="password"
          className="vl-settings-input"
          placeholder={`${preset.label} API Key(${preset.keyHint})`}
          value={keys[preset.id] ?? ""}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <input
          className="vl-settings-input"
          list="vl-ai-models"
          placeholder="模型"
          value={models[preset.id] ?? preset.defaultModel}
          onChange={(e) => setModel(e.target.value)}
        />
        <datalist id="vl-ai-models">
          {preset.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </datalist>
        <div>
          <div className="mb-1 text-[11px]" style={{ color: "var(--vl-text-faint)" }}>
            Base URL
          </div>
          <input
            className="vl-settings-input"
            placeholder={preset.baseUrl || "https://…"}
            value={effectiveBaseUrl}
            onChange={(e) => setBaseUrlOverride(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border px-2.5 py-1.5 text-xs transition-colors"
          style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
          disabled={testing}
          onClick={() => {
            setTesting(true);
            setTestResult(null);
            complete("你是连通性测试助手。", "回复:连接正常")
              .then((text) =>
                setTestResult(`✓ 成功:${text.slice(0, 80)}`),
              )
              .catch((e: unknown) =>
                setTestResult(`✗ ${e instanceof Error ? e.message : String(e)}`),
              )
              .finally(() => setTesting(false));
          }}
        >
          {testing ? "测试中…" : "测试连接"}
        </button>
        {testResult && (
          <span
            className="flex-1 text-[11px] leading-snug"
            style={{
              color: testResult.startsWith("✓")
                ? "var(--vl-success)"
                : "var(--vl-danger)",
              wordBreak: "break-all",
            }}
          >
            {testResult}
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: "var(--vl-text-faint)" }}>
        每个供应商独立记忆 Key、模型与 Base URL;模型可手填。选中文字后可
        优化/翻译/总结/扩写;⌘L 打开 AI 对话。
      </p>
    </div>
  );
}

// ── 快捷键 ────────────────────────────────────────────────

function ShortcutsTab() {
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const resetShortcuts = useShortcutStore((s) => s.resetShortcuts);

  return (
    <div className="vl-settings-body">
      <div className="flex items-center justify-between">
        <div className="vl-settings-label">全局快捷键</div>
        <button
          type="button"
          className="text-xs"
          style={{ color: "var(--vl-text-muted)" }}
          onClick={resetShortcuts}
        >
          重置默认
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map((action) => (
          <div key={action} className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--vl-text)" }}>
              {SHORTCUT_LABELS[action]}
            </span>
            <ShortcutInput action={action} value={shortcuts[action]} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: "var(--vl-text-faint)" }}>
        点击右侧按钮后按下新组合键;Esc 取消。编辑器内格式化快捷键(⌘1 标题、
        ⌘⌥C 代码块等)见 段落/格式 菜单。
      </p>
    </div>
  );
}

/** 快捷键捕获输入:点击进入录制,下一次按键成为新组合 */
function ShortcutInput({
  action,
  value,
}: {
  action: ShortcutAction;
  value: string;
}) {
  const setShortcut = useShortcutStore((s) => s.setShortcut);
  const [recording, setRecording] = useState(false);

  return (
    <button
      type="button"
      className="min-w-24 rounded-md border px-2 py-1 text-center font-mono text-xs transition-colors"
      style={{
        borderColor: recording ? "var(--vl-accent)" : "var(--vl-border)",
        background: recording ? "var(--vl-accent-soft)" : "transparent",
        color: recording ? "var(--vl-accent-text)" : "var(--vl-text)",
      }}
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(e) => {
        if (!recording) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Escape") {
          setRecording(false);
          return;
        }
        const combo = comboFromEvent(e);
        if (combo && combo.includes("+")) {
          setShortcut(action, combo);
          setRecording(false);
        }
      }}
    >
      {recording ? "按下快捷键…" : value}
    </button>
  );
}
