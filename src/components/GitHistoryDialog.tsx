import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { GitCommitHorizontal, History, X } from "lucide-react";
import { gitLog, gitShow, type GitCommit } from "../state/gitStore";

/** 文件 Git 历史面板:提交列表,点击 commit 看该次对该文件的 diff。 */
export function GitHistoryDialog({
  open,
  onOpenChange,
  path,
  fileName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 项目内相对路径 */
  path: string;
  fileName: string;
}) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<{ hash: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !path) return;
    setLoading(true);
    setError(null);
    gitLog(path)
      .then(setCommits)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open, path]);

  const showDiff = async (hash: string) => {
    try {
      const text = await gitShow(hash, path);
      setDiff({ hash, text });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="vl-dialog-overlay" />
        <Dialog.Content
          className="vl-dialog"
          style={{ width: 760, maxWidth: "94vw", height: 560, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="flex items-center gap-1.5 text-sm font-semibold">
              <History size={14} /> {fileName} · 提交历史
            </Dialog.Title>
            <Dialog.Close className="vl-dialog-close">
              <X size={14} />
            </Dialog.Close>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 gap-3">
            {/* 提交列表 */}
            <div className="w-64 shrink-0 overflow-y-auto" style={{ borderRight: "1px solid var(--vl-border)" }}>
              {loading && (
                <div className="p-3 text-xs" style={{ color: "var(--vl-text-faint)" }}>加载中…</div>
              )}
              {error && (
                <div className="p-3 text-xs" style={{ color: "var(--vl-danger)" }}>{error}</div>
              )}
              {commits.map((c) => {
                const active = diff?.hash === c.hash;
                return (
                  <button
                    key={c.hash}
                    type="button"
                    className="block w-full border-b px-3 py-2 text-left transition-colors hover:bg-[var(--vl-panel-active)]"
                    style={{
                      borderColor: "var(--vl-border)",
                      background: active ? "var(--vl-accent-soft)" : "transparent",
                    }}
                    onClick={() => void showDiff(c.hash)}
                  >
                    <div className="flex items-center gap-1.5">
                      <GitCommitHorizontal size={12} style={{ color: "var(--vl-accent)" }} />
                      <code className="text-[11px]" style={{ color: "var(--vl-accent-text)" }}>
                        {c.hash}
                      </code>
                      <span className="ml-auto text-[10px]" style={{ color: "var(--vl-text-faint)" }}>
                        {c.date}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs" style={{ color: "var(--vl-text)" }}>
                      {c.message || "(无消息)"}
                    </div>
                    <div className="truncate text-[10px]" style={{ color: "var(--vl-text-faint)" }}>
                      {c.author}
                    </div>
                  </button>
                );
              })}
              {!loading && commits.length === 0 && !error && (
                <div className="p-3 text-xs" style={{ color: "var(--vl-text-faint)" }}>没有提交历史</div>
              )}
            </div>

            {/* diff 展示 */}
            <div className="min-w-0 flex-1 overflow-y-auto">
              {diff ? (
                <pre
                  className="p-3 text-[11px] leading-relaxed"
                  style={{
                    background: "var(--vl-code-bg)",
                    color: "var(--vl-code-text)",
                    fontFamily: "var(--vl-font-mono)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    margin: 0,
                    minHeight: "100%",
                  }}
                >
                  {diff.text || "(该提交未改动此文件)"}
                </pre>
              ) : (
                <div className="flex h-full items-center justify-center text-xs" style={{ color: "var(--vl-text-faint)" }}>
                  选择左侧提交查看改动
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
