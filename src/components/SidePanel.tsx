import { useState } from "react";
import { Files, ListTree, GitBranch, ShieldCheck } from "lucide-react";
import { Explorer } from "./Explorer";
import { Outline } from "./Outline";
import { GitPanel } from "./GitPanel";
import { LinkCheckPanel } from "./LinkCheckPanel";
import { usePanelResize } from "./usePanelResize";

type Tab = "files" | "outline" | "git" | "check";

/** 左侧面板:文件树 / 大纲 / Git 变更 / 检查 切换;右缘可拖拽调宽 */
export function SidePanel() {
  const [tab, setTab] = useState<Tab>("files");
  const { width, onMouseDown } = usePanelResize("left", 224, 160, 520);

  return (
    <div
      className="vl-dimmable-panel relative flex shrink-0 flex-col border-r"
      style={{
        width,
        borderColor: "var(--vl-border)",
        background: "var(--vl-panel)",
      }}
    >
      {/* 拖拽调宽手柄 */}
      <div
        className="vl-resize-handle-r"
        onMouseDown={onMouseDown}
        title="拖拽调整宽度"
      />
      <div
        className="flex shrink-0 border-b"
        style={{ borderColor: "var(--vl-border)" }}
      >
        <TabButton
          active={tab === "files"}
          onClick={() => setTab("files")}
          icon={<Files size={13} />}
          label="文件"
        />
        <TabButton
          active={tab === "outline"}
          onClick={() => setTab("outline")}
          icon={<ListTree size={13} />}
          label="大纲"
        />
        <TabButton
          active={tab === "git"}
          onClick={() => setTab("git")}
          icon={<GitBranch size={13} />}
          label="变更"
        />
        <TabButton
          active={tab === "check"}
          onClick={() => setTab("check")}
          icon={<ShieldCheck size={13} />}
          label="检查"
        />
      </div>
      {tab === "files" && <Explorer bare />}
      {tab === "outline" && <Outline />}
      {tab === "git" && <GitPanel />}
      {tab === "check" && <LinkCheckPanel />}
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
