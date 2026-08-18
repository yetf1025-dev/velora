import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { GitCommitHorizontal, History, RefreshCw, FileDiff, X } from "lucide-react";
import { gitDiff, useGitStore } from "../state/gitStore";
import { useAppStore } from "../state/appStore";
import { openFilePath } from "../editor/editorController";
import { isMarkdownPath } from "../platform/projectService";

/** Git 变更面板:状态列表 + 提交 + diff 查看 */
export function GitPanel() {
  const { isRepo, branch, changes, refresh, commitAll } = useGitStore();
  const projectRoot = useAppStore((s) => s.projectRoot);
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [diff, setDiff] = useState<{ path: string; text: string } | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh, projectRoot]);

  if (!projectRoot) {
    return <EmptyHint text="先打开一个文件夹" />;
  }
  if (!isRepo) {
    return <EmptyHint text="当前文件夹不是 Git 仓库" />;
  }

  const commit = async () => {
    if (!message.trim()) return;
    setCommitting(true);
    try {
      await commitAll(message.trim());
      setMessage("");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--vl-border)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--vl-text-muted)" }}>
          {branch || "(无分支)"}
        </span>
        <button
          type="button"
          className="rounded p-1 transition-colors hover:bg-[var(--vl-panel-active)]"
          style={{ color: "var(--vl-text-muted)" }}
          onClick={() => void refresh()}
          title="刷新"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {changes.length === 0 ? (
          <EmptyHint text="工作区干净,没有变更" />
        ) : (
          changes.map((c) => (
            <div
              key={c.path + c.status}
              className="flex items-center gap-1.5 py-[3px] pl-3 pr-2 text-[13px]"
              style={{ color: "var(--vl-text)" }}
            >
              <span
                className="w-4 shrink-0 text-center font-mono text-[11px] font-semibold"
                style={{ color: statusColor(c.status) }}
                title={statusLabel(c.status)}
              >
                {c.status.replace("?", "U")}
              </span>
              <button
                type="button"
                className="truncate text-left hover:underline"
                onClick={() => {
                  if (isMarkdownPath(c.path)) {
                    void openFilePath(`${projectRoot}/${c.path}`);
                  }
                }}
                title={c.path}
              >
                {c.path}
              </button>
              <button
                type="button"
                className="ml-auto shrink-0 rounded p-0.5 transition-colors hover:bg-[var(--vl-panel-active)]"
                style={{ color: "var(--vl-text-faint)" }}
                title="查看 diff"
                onClick={async () => {
                  const text = await gitDiff(c.path);
                  setDiff({ path: c.path, text });
                }}
              >
                <FileDiff size={13} />
              </button>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 transition-colors hover:bg-[var(--vl-panel-active)]"
                style={{ color: "var(--vl-text-faint)" }}
                title="提交历史"
                onClick={() => useAppStore.getState().setGitHistoryPath(c.path)}
              >
                <History size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {changes.length > 0 && (
        <div
          className="shrink-0 border-t p-2"
          style={{ borderColor: "var(--vl-border)" }}
        >
          <input
            className="mb-1.5 w-full rounded-md border px-2 py-1.5 text-xs outline-none"
            style={{
              borderColor: "var(--vl-border)",
              background: "var(--vl-bg)",
              color: "var(--vl-text)",
            }}
            placeholder="提交信息…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void commit();
            }}
          />
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-opacity"
            style={{
              background: "var(--vl-accent)",
              color: "#fff",
              opacity: message.trim() && !committing ? 1 : 0.45,
            }}
            disabled={!message.trim() || committing}
            onClick={() => void commit()}
          >
            <GitCommitHorizontal size={13} />
            {committing ? "提交中…" : `提交全部变更 (⌘Enter)`}
          </button>
        </div>
      )}

      <Dialog.Root open={diff !== null} onOpenChange={() => setDiff(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="vl-dialog-overlay" />
          <Dialog.Content
            className="vl-dialog"
            style={{ width: 720, maxWidth: "92vw" }}
            aria-describedby={undefined}
          >
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold">
                {diff?.path}
              </Dialog.Title>
              <Dialog.Close className="vl-dialog-close">
                <X size={14} />
              </Dialog.Close>
            </div>
            <pre
              className="mt-3 max-h-[60vh] overflow-auto rounded-md p-3 text-[11px] leading-relaxed"
              style={{
                background: "var(--vl-code-bg)",
                color: "var(--vl-code-text)",
                fontFamily: "var(--vl-font-mono)",
              }}
            >
              {diff?.text || "(无 diff 内容,可能是新文件)"}
            </pre>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center p-4 text-center text-xs"
      style={{ color: "var(--vl-text-faint)" }}
    >
      {text}
    </div>
  );
}

function statusColor(status: string): string {
  if (status.includes("?")) return "var(--vl-success)";
  if (status.includes("D")) return "var(--vl-danger)";
  if (status.includes("A")) return "var(--vl-success)";
  return "var(--vl-warning)";
}

function statusLabel(status: string): string {
  if (status.includes("?")) return "未跟踪";
  if (status.includes("D")) return "已删除";
  if (status.includes("A")) return "新增";
  if (status.includes("M")) return "已修改";
  return status;
}
