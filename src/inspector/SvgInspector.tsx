import { useEffect, useState } from "react";
import { Download, Loader2, PenTool, Sparkles } from "lucide-react";
import { exportTextFile, readTextFile, writeTextFile } from "../platform/fileService";
import { getEditor } from "../editor/editorController";
import { aiOnSvg } from "../ai/aiService";
import { usePendingAiStore } from "../ai/pendingAiStore";
import { useAppStore } from "../state/appStore";
import { useSvgRefreshStore } from "../editor/extensions/svg/svgRefresh";
import { resolveRelative } from "../platform/assetPath";
import { SvgCanvasEditor } from "../editor/extensions/svg/SvgCanvasEditor";

/** SVG Inspector:选中 SVG 节点时的上下文面板(导出 + AI 修改源码) */
export function SvgInspector({ pos }: { pos: number }) {
  const currentFilePath = useAppStore((s) => s.currentFilePath);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasSource, setCanvasSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editor = getEditor();
  const canvasRequest = useSvgRefreshStore((s) => s.canvasRequest);

  // 右键菜单"画布编辑"请求
  useEffect(() => {
    if (canvasRequest === 0) return;
    void (async () => {
      try {
        setCanvasSource(await loadSource());
        setCanvasOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRequest]);

  // 订阅事务,属性变化后重渲染
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const bump = () => setVersion((v) => v + 1);
    editor.on("transaction", bump);
    return () => {
      editor.off("transaction", bump);
    };
  }, [editor]);

  const node = editor?.state.doc.nodeAt(pos);
  if (!editor || !node || node.type.name !== "svgBlock") return null;

  const src = (node.attrs.src as string | null) ?? null;
  const inlineSource = (node.attrs.source as string | null) ?? null;

  /** 读取当前 SVG 源码(内联直接取,文件来源读盘) */
  const loadSource = async (): Promise<string> => {
    if (inlineSource !== null) return inlineSource;
    if (src && currentFilePath) {
      return readTextFile(resolveRelative(currentFilePath, src));
    }
    throw new Error("无法获取 SVG 源码");
  };

  /** 把 AI 修改后的源码写回:内联写节点属性,文件来源写回磁盘 */
  const applySource = async (next: string) => {
    if (inlineSource !== null) {
      const { state, view } = editor;
      view.dispatch(
        state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: next }),
      );
    } else if (src && currentFilePath) {
      await writeTextFile(resolveRelative(currentFilePath, src), next);
      useSvgRefreshStore.getState().bump();
    }
  };

  const runAi = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const current = await loadSource();
      const next = await aiOnSvg(current, text.trim());
      if (!next.startsWith("<svg")) {
        throw new Error(`AI 返回的不是合法 SVG:${next.slice(0, 120)}`);
      }
      // ADR-004:放待应用 store,Diff 面板 Accept/Reject
      usePendingAiStore.getState().set({
        pos,
        kind: "SVG",
        attr: "source",
        before: current,
        after: next,
        apply: () => {
          // apply 在 Accept 时调用;但文件来源是异步写盘,apply 需保持同步签名。
          // 这里:内联走同步 transaction;文件来源也直接写(异步执行,Diff 已预览)
          void applySource(next);
        },
      });
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const exportSvg = async () => {
    try {
      const source = await loadSource();
      await exportTextFile("image.svg", source);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <div>
        <div
          className="mb-1.5 text-xs font-medium"
          style={{ color: "var(--vl-text-muted)" }}
        >
          来源
        </div>
        <div
          className="truncate text-xs"
          style={{ color: "var(--vl-text)" }}
          title={src ?? "内联 SVG"}
        >
          {src ?? "内联 SVG"}
        </div>
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors"
          style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
          onClick={() => void exportSvg()}
        >
          <Download size={12} />
          导出
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors"
          style={{
            borderColor: "var(--vl-accent)",
            color: "var(--vl-accent-text)",
            background: "var(--vl-accent-soft)",
          }}
          onClick={async () => {
            try {
              setCanvasSource(await loadSource());
              setCanvasOpen(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          <PenTool size={12} />
          画布编辑
        </button>
      </div>

      <div className="border-t pt-3" style={{ borderColor: "var(--vl-border)" }}>
        <div
          className="mb-1.5 flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--vl-text-muted)" }}
        >
          <Sparkles size={12} />
          AI 修改 SVG
        </div>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {[
            {
              label: "疏松布局",
              prompt:
                "元素太紧凑:拉开节点间距(至少 24-40px),让箭头/连线舒展完整显示,并同步扩大画布",
            },
            {
              label: "修复短箭头",
              prompt: "箭头被压得太短:加长连接线的起点/终点坐标,让箭头完整显示且不压节点边缘",
            },
            { label: "适配暗色", prompt: "把配色改为适合暗色背景的方案" },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              className="rounded-md border px-2 py-1 text-[11px] transition-colors"
              style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
              disabled={loading}
              title={a.prompt}
              onClick={() => void runAi(a.prompt)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs outline-none"
            style={{
              borderColor: "var(--vl-border)",
              background: "var(--vl-bg)",
              color: "var(--vl-text)",
            }}
            placeholder="如:节点间距太小,拉开到 40px"
            value={instruction}
            disabled={loading}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runAi(instruction);
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium"
            style={{
              background: "var(--vl-accent)",
              color: "#fff",
              opacity: instruction.trim() && !loading ? 1 : 0.45,
            }}
            disabled={!instruction.trim() || loading}
            onClick={() => void runAi(instruction)}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : "执行"}
          </button>
        </div>
        {src && (
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--vl-text-faint)" }}>
            文件来源的 SVG,AI 修改会直接写回 {src}
          </p>
        )}
        {error && (
          <div className="mt-1.5 text-[11px]" style={{ color: "var(--vl-danger)" }}>
            {error}
          </div>
        )}
      </div>

      <SvgCanvasEditor
        open={canvasOpen}
        onOpenChange={setCanvasOpen}
        svgSource={canvasSource}
        onSave={applySource}
      />
    </div>
  );
}
