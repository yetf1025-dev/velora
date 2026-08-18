import {
  ChevronRight,
  FileText,
  File as FileIcon,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import type { FileNode } from "../state/appStore";
import { useAppStore } from "../state/appStore";
import {
  openFilePath,
  openProject,
  refreshFileTree,
} from "../editor/editorController";
import { isMarkdownPath } from "../platform/projectService";

/** Project Explorer:文件夹树 + 点击打开 + 刷新。bare 模式下不渲染外层边框(嵌在 SidePanel 里) */
export function Explorer({ bare = false }: { bare?: boolean }) {
  const projectRoot = useAppStore((s) => s.projectRoot);
  const fileTree = useAppStore((s) => s.fileTree);

  const content = (
    <>
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--vl-border)" }}
      >
        <span
          className="text-xs font-medium"
          style={{ color: "var(--vl-text-muted)" }}
        >
          {projectRoot ? basename(projectRoot) : "Explorer"}
        </span>
        <div className="flex items-center gap-0.5">
          {projectRoot && (
            <button
              type="button"
              className="rounded p-1 transition-colors hover:bg-[var(--vl-panel-active)]"
              style={{ color: "var(--vl-text-muted)" }}
              onClick={() => void refreshFileTree()}
              title="刷新"
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button
            type="button"
            className="rounded p-1 transition-colors hover:bg-[var(--vl-panel-active)]"
            style={{ color: "var(--vl-text-muted)" }}
            onClick={() => void openProject()}
            title="打开文件夹"
          >
            <FolderPlus size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {projectRoot ? (
          fileTree.map((node) => <TreeNode key={node.path} node={node} depth={0} />)
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
            <span
              className="text-center text-xs"
              style={{ color: "var(--vl-text-faint)" }}
            >
              打开一个文件夹
              <br />
              把一组文档当作项目来管理
            </span>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-xs transition-colors"
              style={{ borderColor: "var(--vl-border)", color: "var(--vl-text)" }}
              onClick={() => void openProject()}
            >
              打开文件夹
            </button>
          </div>
        )}
      </div>
    </>
  );

  if (bare) {
    return <div className="flex min-h-0 flex-1 flex-col">{content}</div>;
  }
  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r"
      style={{ borderColor: "var(--vl-border)", background: "var(--vl-panel)" }}
    >
      {content}
    </aside>
  );
}

function TreeNode({ node, depth }: { node: FileNode; depth: number }) {
  const expandedPaths = useAppStore((s) => s.expandedPaths);
  const toggleExpanded = useAppStore((s) => s.toggleExpanded);
  const currentFilePath = useAppStore((s) => s.currentFilePath);
  const dirty = useAppStore((s) => s.dirty);

  const expanded = expandedPaths.includes(node.path);
  const isCurrent = currentFilePath === node.path;
  const openable = !node.isDir && isMarkdownPath(node.path);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1 py-[3px] pr-2 text-left text-[13px] transition-colors"
        style={{
          paddingLeft: `${depth * 14 + 8}px`,
          color: isCurrent
            ? "var(--vl-accent-text)"
            : openable || node.isDir
              ? "var(--vl-text)"
              : "var(--vl-text-faint)",
          background: isCurrent ? "var(--vl-accent-soft)" : "transparent",
        }}
        onClick={() => {
          if (node.isDir) toggleExpanded(node.path);
          else if (openable) void openFilePath(node.path);
        }}
      >
        {node.isDir ? (
          <>
            <ChevronRight
              size={12}
              style={{
                transform: expanded ? "rotate(90deg)" : "none",
                transition: "transform var(--vl-transition)",
                flexShrink: 0,
              }}
            />
            {expanded ? <FolderOpen size={13} /> : <Folder size={13} />}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <FileTypeIcon name={node.name} />
          </>
        )}
        <span className="truncate">{node.name}</span>
        {isCurrent && dirty && <span style={{ color: "var(--vl-accent)" }}>•</span>}
      </button>
      {node.isDir &&
        expanded &&
        node.children?.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

function FileTypeIcon({ name }: { name: string }) {
  if (isMarkdownPath(name)) return <FileText size={13} />;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return <ImageIcon size={13} />;
  return <FileIcon size={13} />;
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}
