import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Terminal, Trash2, X, ExternalLink } from "lucide-react";
import { clearLog, readLog } from "../platform/logService";
import { useAppStore } from "../state/appStore";

/** 开发模式:日志面板,显示最近 200 行,含错误高亮 */
export function LogPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setContent(await readLog(300));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void refresh();
      useAppStore.getState().clearError();
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="vl-dialog-overlay" />
        <Dialog.Content
          className="vl-dialog"
          style={{
            width: 820,
            maxWidth: "94vw",
            height: 520,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="flex items-center gap-1.5 text-sm font-semibold">
              <Terminal size={14} /> 日志(开发模式)
            </Dialog.Title>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded p-1 hover:bg-[var(--vl-panel-active)]"
                style={{ color: "var(--vl-text-muted)" }}
                onClick={async () => {
                  const { openLogFile } = await import("../platform/logService");
                  void openLogFile();
                }}
                title="在系统中打开日志文件"
              >
                <ExternalLink size={13} />
              </button>
              <button
                type="button"
                className="rounded p-1 hover:bg-[var(--vl-panel-active)]"
                style={{ color: "var(--vl-text-muted)" }}
                onClick={() => void refresh()}
                title="刷新"
                disabled={loading}
              >
                <Terminal size={13} />
              </button>
              <button
                type="button"
                className="rounded p-1 hover:bg-[var(--vl-panel-active)]"
                style={{ color: "var(--vl-text-muted)" }}
                onClick={async () => {
                  await clearLog();
                  setContent("");
                }}
                title="清空"
              >
                <Trash2 size={13} />
              </button>
              <Dialog.Close className="vl-dialog-close">
                <X size={14} />
              </Dialog.Close>
            </div>
          </div>

          <pre
            className="mt-3 flex-1 overflow-auto rounded-md p-3 text-[11px] leading-relaxed"
            style={{
              background: "var(--vl-code-bg)",
              color: "var(--vl-code-text)",
              fontFamily: "var(--vl-font-mono)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              margin: 0,
            }}
          >
            {content || "(暂无日志)"}
          </pre>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
