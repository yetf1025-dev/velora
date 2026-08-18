import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useAppStore } from "../state/appStore";
import {
  collectMarkdownFiles,
  scanBrokenLinks,
  type LinkIssue,
} from "../project/linkChecker";
import { readTextFile } from "../platform/fileService";
import { openFilePath } from "../editor/editorController";

/** 检查面板:扫描项目失效链接/缺失图片,点击跳转到源文件。 */
export function LinkCheckPanel() {
  const projectRoot = useAppStore((s) => s.projectRoot);
  const fileTree = useAppStore((s) => s.fileTree);
  const [issues, setIssues] = useState<LinkIssue[] | null>(null);
  const [scanning, setScanning] = useState(false);

  const run = async () => {
    if (!projectRoot) return;
    setScanning(true);
    try {
      const files = collectMarkdownFiles(fileTree);
      const contents = new Map<string, string>();
      await Promise.all(
        files.map(async (p) => {
          try {
            contents.set(p, await readTextFile(p));
          } catch {
            /* 读失败跳过 */
          }
        }),
      );
      setIssues(scanBrokenLinks(projectRoot, fileTree, contents));
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (projectRoot) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectRoot]);

  if (!projectRoot) {
    return <Empty text="先打开一个文件夹" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--vl-border)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--vl-text-muted)" }}>
          {issues == null ? "—" : `${issues.length} 个问题`}
        </span>
        <button
          type="button"
          className="rounded p-1 transition-colors hover:bg-[var(--vl-panel-active)]"
          style={{ color: "var(--vl-text-muted)" }}
          onClick={() => void run()}
          title="重新扫描"
        >
          <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {issues == null ? (
          <Empty text={scanning ? "扫描中…" : ""} />
        ) : issues.length === 0 ? (
          <div
            className="flex items-center gap-1.5 px-3 py-2 text-xs"
            style={{ color: "var(--vl-success)" }}
          >
            <CheckCircle2 size={13} />
            没有失效链接
          </div>
        ) : (
          issues.map((iss, i) => (
            <button
              key={i}
              type="button"
              className="flex w-full items-start gap-1.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--vl-panel-active)]"
              style={{ color: "var(--vl-text)" }}
              onClick={() => {
                if (iss.from.endsWith(".md")) void openFilePath(iss.from);
              }}
              title={`${iss.from}:${iss.line}`}
            >
              <AlertTriangle
                size={12}
                style={{
                  color:
                    iss.issue === "missing-image" ? "var(--vl-warning)" : "var(--vl-danger)",
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
              <span className="min-w-0">
                <span style={{ color: "var(--vl-danger)" }}>{iss.target}</span>
                <span style={{ color: "var(--vl-text-faint)" }}>
                  {" "}
                  ({iss.kind === "image" ? "图片" : "链接"})
                </span>
                <br />
                <span className="truncate" style={{ color: "var(--vl-text-faint)" }}>
                  {basename(iss.from)}:{iss.line}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center p-4 text-center text-xs"
      style={{ color: "var(--vl-text-faint)" }}
    >
      {text}
    </div>
  );
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}
