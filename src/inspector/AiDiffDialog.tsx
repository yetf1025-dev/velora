import * as Dialog from "@radix-ui/react-dialog";
import { Check, GitCompare, X } from "lucide-react";
import { usePendingAiStore } from "../ai/pendingAiStore";

/** AI 修改 Diff 预览:逐行对比 before/after,Accept 应用 / Reject 丢弃 */

export function AiDiffDialog() {
  const edit = usePendingAiStore((s) => s.current);
  const clear = usePendingAiStore((s) => s.clear);

  return (
    <Dialog.Root open={!!edit} onOpenChange={(o) => !o && clear()}>
      <Dialog.Portal>
        <Dialog.Overlay className="vl-dialog-overlay" />
        <Dialog.Content
          className="vl-dialog"
          style={{ width: 720, maxWidth: "94vw" }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="flex items-center gap-1.5 text-sm font-semibold">
              <GitCompare size={14} />
              AI 修改预览 · {edit?.kind} / {edit?.attr}
            </Dialog.Title>
            <Dialog.Close className="vl-dialog-close">
              <X size={14} />
            </Dialog.Close>
          </div>

          {edit && (
            <>
              <div
                className="mt-3 max-h-[50vh] overflow-auto rounded-md"
                style={{
                  background: "var(--vl-code-bg)",
                  fontFamily: "var(--vl-font-mono)",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                <DiffView before={edit.before} after={edit.after} />
              </div>
              <p
                className="mt-2 text-[11px]"
                style={{ color: "var(--vl-text-faint)" }}
              >
                应用后可用 ⌘Z 撤销(走 ProseMirror 事务栈)。
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-xs"
                  style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
                  onClick={clear}
                >
                  拒绝
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium"
                  style={{ background: "var(--vl-accent)", color: "#fff" }}
                  onClick={() => {
                    edit.apply();
                    clear();
                  }}
                >
                  <Check size={12} /> 应用
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** 简单逐行 diff:基于 LCS 的高效近似(按行匹配,前后对齐)。
 *  对源码场景足够清晰:行级增删,不做字符级。 */
function DiffView({ before, after }: { before: string; after: string }) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const rows: { kind: "same" | "del" | "add"; text: string }[] = [];
  // 对比同位置行:相同记 same,不同记 del+add,多出行记 add
  const n = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < n; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b !== undefined && a !== undefined) {
      if (b === a) rows.push({ kind: "same", text: a });
      else {
        rows.push({ kind: "del", text: b });
        rows.push({ kind: "add", text: a });
      }
    } else if (a !== undefined) {
      rows.push({ kind: "add", text: a });
    } else if (b !== undefined) {
      rows.push({ kind: "del", text: b });
    }
  }

  return (
    <div>
      {rows.map((r, i) => {
        const color =
          r.kind === "add"
            ? "var(--vl-success)"
            : r.kind === "del"
              ? "var(--vl-danger)"
              : "var(--vl-text-muted)";
        const bg =
          r.kind === "add"
            ? "rgba(22,163,74,0.1)"
            : r.kind === "del"
              ? "rgba(220,38,38,0.1)"
              : "transparent";
        const prefix = r.kind === "add" ? "+ " : r.kind === "del" ? "- " : "  ";
        return (
          <div key={i} style={{ color, background: bg, padding: "0 10px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            <span style={{ opacity: 0.6 }}>{prefix}</span>
            {r.text || " "}
          </div>
        );
      })}
    </div>
  );
}
