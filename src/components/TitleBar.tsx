import { useAppStore } from "../state/appStore";

/** 顶部标题栏:显示当前文件名,可拖拽移动窗口 */
export function TitleBar() {
  const currentFilePath = useAppStore((s) => s.currentFilePath);
  const dirty = useAppStore((s) => s.dirty);

  const fileName = currentFilePath
    ? (currentFilePath.split("/").pop() ?? currentFilePath)
    : null;

  return (
    <div
      className="flex h-9 shrink-0 items-center justify-center border-b"
      style={{
        borderColor: "var(--vl-border)",
        background: "var(--vl-panel)",
        // @ts-expect-error Electron/Tauri 拖拽区域
        WebkitAppRegion: "drag",
      }}
    >
      <span
        className="text-xs font-medium"
        style={{ color: "var(--vl-text-muted)", userSelect: "none" }}
        title={currentFilePath ?? undefined}
      >
        {fileName ?? "Velora"}
        {dirty ? " •" : ""}
      </span>
    </div>
  );
}
