import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  FolderOpen,
  Moon,
  Save,
  FileDown,
  PanelLeft,
  PanelRight,
  Code,
  Settings as SettingsIcon,
  GitBranch,
  Sparkles,
  Clock,
} from "lucide-react";
import type { FileNode } from "../state/appStore";
import { useAppStore } from "../state/appStore";
import { useRecentStore } from "../settings/recentStore";
import {
  exportHtml,
  openFile,
  openFilePath,
  openProject,
  saveFile,
  switchEditMode,
} from "../editor/editorController";
import { isMarkdownPath } from "../platform/projectService";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

/** Command Palette(⌘K):应用命令 + 项目文件快速跳转 */
export function CommandPalette({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const fileTree = useAppStore((s) => s.fileTree);
  const projectRoot = useAppStore((s) => s.projectRoot);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands: PaletteItem[] = useMemo(
    () => [
      { id: "open", label: "打开文件…", icon: <FileText size={14} />, run: () => void openFile() },
      { id: "openFolder", label: "打开文件夹…", icon: <FolderOpen size={14} />, run: () => void openProject() },
      { id: "save", label: "保存", hint: "⌘S", icon: <Save size={14} />, run: () => void saveFile() },
      { id: "export", label: "导出 HTML", icon: <FileDown size={14} />, run: () => void exportHtml() },
      {
        id: "theme",
        label: "切换亮/暗主题",
        icon: <Moon size={14} />,
        run: () => useAppStore.getState().toggleTheme(),
      },
      {
        id: "explorer",
        label: "切换左侧面板",
        hint: "⌘B",
        icon: <PanelLeft size={14} />,
        run: () => useAppStore.getState().toggleExplorer(),
      },
      {
        id: "inspector",
        label: "切换 Inspector",
        hint: "⌘J",
        icon: <PanelRight size={14} />,
        run: () => useAppStore.getState().toggleInspector(),
      },
      {
        id: "mode",
        label: "切换 视觉/源码 模式",
        icon: <Code size={14} />,
        run: () =>
          switchEditMode(
            useAppStore.getState().editMode === "visual" ? "source" : "visual",
          ),
      },
      {
        id: "ai",
        label: "AI 设置(API Key)",
        icon: <Sparkles size={14} />,
        run: onOpenSettings,
      },
      {
        id: "settings",
        label: "设置",
        icon: <SettingsIcon size={14} />,
        run: onOpenSettings,
      },
    ],
    [onOpenSettings],
  );

  const files: PaletteItem[] = useMemo(() => {
    const out: PaletteItem[] = [];
    const walk = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.isDir) walk(n.children ?? []);
        else if (isMarkdownPath(n.path)) {
          out.push({
            id: `file:${n.path}`,
            label: n.name,
            hint: projectRoot ? n.path.slice(projectRoot.length + 1) : n.path,
            icon: <FileText size={14} />,
            run: () => void openFilePath(n.path),
          });
        }
      }
    };
    walk(fileTree);
    return out;
  }, [fileTree, projectRoot]);

  const recentFiles = useRecentStore((s) => s.recentFiles);

  const recents: PaletteItem[] = useMemo(
    () =>
      recentFiles.slice(0, 6).map((path) => ({
        id: `recent:${path}`,
        label: path.split("/").pop() ?? path,
        hint: "最近",
        icon: <Clock size={14} />,
        run: () => void openFilePath(path),
      })),
    [recentFiles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (item: PaletteItem) =>
      !q ||
      item.label.toLowerCase().includes(q) ||
      (item.hint ?? "").toLowerCase().includes(q) ||
      (item.id.startsWith("recent:") && item.id.slice(7).toLowerCase().includes(q));
    // 无查询:命令 + 最近文件;有查询:最近/项目文件 + 命令
    const matchedRecents = recents.filter(match);
    const matchedFiles = files.filter(match);
    const matchedCommands = commands.filter(match);
    return q
      ? [...matchedRecents, ...matchedFiles, ...matchedCommands].slice(0, 12)
      : [...matchedCommands, ...matchedRecents].slice(0, 12);
  }, [query, files, commands, recents]);

  useEffect(() => setActiveIndex(0), [filtered.length]);

  if (!open) return null;

  const close = () => setOpen(false);
  const runItem = (item: PaletteItem) => {
    close();
    item.run();
  };

  return (
    <div className="vl-palette-overlay" onClick={close}>
      <div className="vl-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="vl-palette-input"
          placeholder="输入命令或文件名…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && filtered[activeIndex]) {
              runItem(filtered[activeIndex]);
            }
          }}
        />
        <div className="vl-palette-list">
          {filtered.length === 0 ? (
            <div className="vl-palette-empty">没有匹配项</div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="vl-palette-item"
                data-active={i === activeIndex || undefined}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => runItem(item)}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
                {item.hint && (
                  <span className="vl-palette-hint truncate">{item.hint}</span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="vl-palette-footer">
          <GitBranch size={11} style={{ marginRight: 4 }} />
          {projectRoot ?? "未打开项目"} · ↑↓ 选择 · Enter 执行 · Esc 关闭
        </div>
      </div>
    </div>
  );
}
