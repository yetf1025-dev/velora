import * as Dialog from "@radix-ui/react-dialog";
import { History, X } from "lucide-react";

/** 启动恢复:发现崩溃前未保存的草稿,提示用户恢复 / 丢弃 / 忽略 */
export function RecoveryDialog({
  open,
  draft,
  onRecover,
  onDiscard,
  onClose,
}: {
  open: boolean;
  draft: string | null;
  onRecover: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  if (!draft) return null;
  const preview = draft.slice(0, 200);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="vl-dialog-overlay" />
        <Dialog.Content
          className="vl-dialog"
          style={{ width: 460 }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="flex items-center gap-1.5 text-sm font-semibold">
              <History size={14} /> 发现未保存的草稿
            </Dialog.Title>
            <Dialog.Close className="vl-dialog-close">
              <X size={14} />
            </Dialog.Close>
          </div>
          <div className="vl-settings-body">
            <p className="text-xs" style={{ color: "var(--vl-text)" }}>
              Velora 上次异常退出时,有一份未保存的内容可以恢复。
            </p>
            <pre
              className="mt-2 max-h-40 overflow-auto rounded-md p-2 text-[11px]"
              style={{
                background: "var(--vl-code-bg)",
                color: "var(--vl-code-text)",
                fontFamily: "var(--vl-font-mono)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {preview}
              {draft.length > 200 ? "\n…" : ""}
            </pre>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-xs"
              style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
              onClick={onDiscard}
            >
              丢弃
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--vl-accent)", color: "#fff" }}
              onClick={onRecover}
            >
              恢复到新文档
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
