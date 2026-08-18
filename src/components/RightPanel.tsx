import { SlidersHorizontal, Sparkles } from "lucide-react";
import { useAppStore } from "../state/appStore";
import { Inspector } from "../inspector/Inspector";
import { AiChatPanel } from "../ai/AiChatPanel";

/** 右侧面板:Inspector / AI 对话 双标签 */
export function RightPanel() {
  const rightTab = useAppStore((s) => s.rightTab);
  const setRightTab = useAppStore((s) => s.setRightTab);

  return (
    <div
      className="flex w-72 shrink-0 flex-col border-l"
      style={{ borderColor: "var(--vl-border)", background: "var(--vl-panel)" }}
    >
      <div
        className="flex shrink-0 border-b"
        style={{ borderColor: "var(--vl-border)" }}
      >
        <TabButton
          active={rightTab === "inspector"}
          onClick={() => setRightTab("inspector")}
          icon={<SlidersHorizontal size={13} />}
          label="Inspector"
        />
        <TabButton
          active={rightTab === "ai"}
          onClick={() => setRightTab("ai")}
          icon={<Sparkles size={13} />}
          label="AI 对话"
        />
      </div>
      {rightTab === "inspector" ? <Inspector bare /> : <AiChatPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs transition-colors"
      style={{
        color: active ? "var(--vl-accent-text)" : "var(--vl-text-muted)",
        borderBottom: active
          ? "2px solid var(--vl-accent)"
          : "2px solid transparent",
        background: "transparent",
      }}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
