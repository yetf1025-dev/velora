import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAppStore } from "../state/appStore";
import { collectMarkdownFiles } from "../project/linkChecker";
import { readTextFile } from "../platform/fileService";
import {
  searchInFiles,
  snippetAround,
  type FileSearchResult,
} from "../project/searchEngine";
import { openFilePath } from "../editor/editorController";

/** 全项目全文搜索面板(⌘⇧F):输入即搜,按文件分组,点击跳转匹配行。 */
export function SearchPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const projectRoot = useAppStore((s) => s.projectRoot);
  const fileTree = useAppStore((s) => s.fileTree);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时聚焦输入
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setError(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 输入即搜(去抖 200ms)
  useEffect(() => {
    if (!open || !query.trim() || !projectRoot) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const files = collectMarkdownFiles(fileTree);
        const contents = new Map<string, string>();
        await Promise.all(
          files.map(async (p) => {
            try {
              contents.set(p, await readTextFile(p));
            } catch {
              /* 跳过 */
            }
          }),
        );
        setResults(searchInFiles(contents, query));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, projectRoot, fileTree]);

  const totalMatches = results.reduce((n, r) => n + r.matches.length, 0);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="vl-dialog-overlay" />
        <Dialog.Content
          className="vl-dialog"
          style={{ width: 600, maxWidth: "94vw", height: 540, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="flex items-center gap-1.5 text-sm font-semibold">
              <Search size={14} /> 全项目搜索
            </Dialog.Title>
            <Dialog.Close className="vl-dialog-close">
              <X size={14} />
            </Dialog.Close>
          </div>

          <div className="relative mt-3">
            <input
              ref={inputRef}
              className="vl-settings-input"
              style={{ padding: "8px 10px 8px 30px" }}
              placeholder={projectRoot ? "搜索项目文档…" : "先打开一个文件夹"}
              value={query}
              disabled={!projectRoot}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 9,
                top: 11,
                color: "var(--vl-text-faint)",
              }}
            />
          </div>

          <div className="mt-1 text-[11px]" style={{ color: "var(--vl-text-faint)" }}>
            {query.trim() && !searching
              ? `${results.length} 个文件 · ${totalMatches} 处匹配`
              : searching
                ? "搜索中…"
                : ""}
            {error && <span style={{ color: "var(--vl-danger)" }}> {error}</span>}
          </div>

          <div className="mt-2 flex-1 overflow-y-auto rounded-md" style={{ background: "var(--vl-panel)" }}>
            {results.length === 0 && query.trim() && !searching && (
              <div className="p-4 text-center text-xs" style={{ color: "var(--vl-text-faint)" }}>
                没有匹配
              </div>
            )}
            {results.map((r) => (
              <div key={r.file}>
                <div
                  className="sticky top-0 truncate px-3 py-1 text-[11px] font-medium"
                  style={{
                    background: "var(--vl-panel)",
                    color: "var(--vl-text-muted)",
                    borderBottom: "1px solid var(--vl-border)",
                  }}
                  title={r.file}
                >
                  {basename(r.file)}{" "}
                  <span style={{ color: "var(--vl-text-faint)" }}>
                    ({r.matches.length})
                  </span>
                </div>
                {r.matches.slice(0, 20).map((m, i) => {
                  const snip = snippetAround(m.text, m.col, m.length);
                  return (
                    <button
                      key={i}
                      type="button"
                      className="block w-full truncate px-3 py-1 text-left text-xs transition-colors hover:bg-[var(--vl-panel-active)]"
                      style={{ color: "var(--vl-text)" }}
                      onClick={() => {
                        if (r.file.endsWith(".md")) {
                          void openFilePath(r.file);
                          onOpenChange(false);
                        }
                      }}
                      title={`${r.file}:${m.line}`}
                    >
                      <span style={{ color: "var(--vl-text-faint)" }}>{m.line}</span>{" "}
                      <span style={{ color: "var(--vl-text-muted)" }}>{snip.before}</span>
                      <mark style={{ background: "var(--vl-accent-soft)", color: "var(--vl-accent-text)", padding: "0 1px" }}>
                        {snip.match}
                      </mark>
                      <span style={{ color: "var(--vl-text-muted)" }}>{snip.after}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}
