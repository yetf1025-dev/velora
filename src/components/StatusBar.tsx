import { useAppStore } from "../state/appStore";
import { useUiZoomStore } from "../settings/uiZoom";
import { useGitStore } from "../state/gitStore";
import { reloadCurrentFile, switchEditMode } from "../editor/editorController";

export function StatusBar() {
  const editMode = useAppStore((s) => s.editMode);
  const dirty = useAppStore((s) => s.dirty);
  const currentFilePath = useAppStore((s) => s.currentFilePath);
  const externalModified = useAppStore((s) => s.externalModified);
  const notice = useAppStore((s) => s.notice);
  const uiZoom = useUiZoomStore((s) => s.zoom);
  const hasNewError = useAppStore((s) => s.hasNewError);
  const setLogPanelOpen = useAppStore((s) => s.setLogPanelOpen);
  const branch = useGitStore((s) => s.branch);
  const isRepo = useGitStore((s) => s.isRepo);
  const changes = useGitStore((s) => s.changes);

  return (
    <footer
      className="flex h-7 shrink-0 items-center gap-3 border-t px-3 text-xs"
      style={{
        borderColor: "var(--vl-border)",
        background: "var(--vl-panel)",
        color: "var(--vl-text-muted)",
      }}
    >
      <button
        type="button"
        className="rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--vl-panel-active)]"
        style={{ color: "var(--vl-text)" }}
        onClick={() =>
          switchEditMode(editMode === "visual" ? "source" : "visual")
        }
        title="切换 视觉/源码 模式"
      >
        {editMode === "visual" ? "Visual" : "Markdown"}
      </button>
      <span>UTF-8</span>
      {uiZoom !== 1 && (
        <button
          type="button"
          title="界面缩放,⌘0 重置"
          onClick={() => void useUiZoomStore.getState().resetZoom()}
          style={{ color: "var(--vl-accent-text)" }}
        >
          {Math.round(uiZoom * 100)}%
        </button>
      )}
      <span className="truncate">
        {currentFilePath ?? "未打开文件"}
        {dirty ? " •" : ""}
      </span>
      <div className="flex-1" />
      {hasNewError && (
        <button
          type="button"
          className="flex items-center gap-1 rounded px-1.5 py-0.5"
          style={{ color: "var(--vl-danger)" }}
          onClick={() => {
            setLogPanelOpen(true);
          }}
          title="有错误,点击查看日志 (⌘D)"
        >
          ● 错误
        </button>
      )}
      {notice && (
        <span style={{ color: "var(--vl-accent-text)" }}>{notice}</span>
      )}
      {externalModified && (
        <button
          type="button"
          className="rounded px-1.5 py-0.5 font-medium"
          style={{ color: "var(--vl-warning)" }}
          onClick={() => void reloadCurrentFile()}
          title="磁盘上的文件比编辑器新,点击放弃本地修改并重新加载"
        >
          ⚠ 文件已被外部修改,点击重新加载
        </button>
      )}
      {isRepo && (
        <span>
          {branch}
          {changes.length > 0 ? ` (${changes.length})` : ""}
        </span>
      )}
    </footer>
  );
}
