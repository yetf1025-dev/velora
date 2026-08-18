import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Printer, X } from "lucide-react";

/**
 * 打印对话框:选纸张 / 横纵 → 调 exportPrint 生成打印 HTML 并系统打开。
 * 用户在系统打印对话框里选"存为 PDF"即得 PDF(原生质量、分页)。
 */
export function PrintDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [paper, setPaper] = useState<"A4" | "letter">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "portrait",
  );

  const print = async () => {
    onOpenChange(false);
    const { exportPrint } = await import("../editor/editorController");
    await exportPrint(paper, orientation);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="vl-dialog-overlay" />
        <Dialog.Content
          className="vl-dialog"
          style={{ width: 380 }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="flex items-center gap-1.5 text-sm font-semibold">
              <Printer size={14} /> 打印 / 导出 PDF
            </Dialog.Title>
            <Dialog.Close className="vl-dialog-close">
              <X size={14} />
            </Dialog.Close>
          </div>

          <div className="vl-settings-body">
            <div className="vl-settings-label">纸张</div>
            <div className="flex gap-2">
              {(["A4", "letter"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-xs transition-colors"
                  style={{
                    borderColor: paper === p ? "var(--vl-accent)" : "var(--vl-border)",
                    background: paper === p ? "var(--vl-accent-soft)" : "transparent",
                    color: "var(--vl-text)",
                  }}
                  onClick={() => setPaper(p)}
                >
                  {p === "A4" ? "A4" : "Letter"}
                </button>
              ))}
            </div>

            <div className="vl-settings-label mt-4">方向</div>
            <div className="flex gap-2">
              {(["portrait", "landscape"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-xs transition-colors"
                  style={{
                    borderColor:
                      orientation === o ? "var(--vl-accent)" : "var(--vl-border)",
                    background: orientation === o ? "var(--vl-accent-soft)" : "transparent",
                    color: "var(--vl-text)",
                  }}
                  onClick={() => setOrientation(o)}
                >
                  {o === "portrait" ? "纵向" : "横向"}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[11px]" style={{ color: "var(--vl-text-faint)" }}>
              将在系统默认程序打开预览,在打印对话框里选「存储为 PDF」。
            </p>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-xs"
                style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
              >
                取消
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--vl-accent)", color: "#fff" }}
              onClick={() => void print()}
            >
              打印
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
