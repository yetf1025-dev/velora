import { create } from "zustand";

export type Theme = "light" | "dark";
export type EditMode = "visual" | "source";

/** Inspector 上下文:选区落在哪个块级节点上(kind 为节点类型名) */
export type InspectorContext = { kind: string; pos: number } | null;

/** 文件树节点(与 Rust read_dir_tree 返回结构一致) */
export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileNode[] | null;
}

interface AppState {
  theme: Theme;
  editMode: EditMode;
  /** 当前文档状态(Step 1 接入真实文档) */
  currentFilePath: string | null;
  dirty: boolean;
  /** 面板可见性 */
  showExplorer: boolean;
  showInspector: boolean;
  inspectorContext: InspectorContext;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  printDialogOpen: boolean;
  searchPanelOpen: boolean;
  /** Git 历史查看的目标文件(相对项目根的路径),null 关闭 */
  gitHistoryPath: string | null;
  logPanelOpen: boolean;
  /** 图表放大查看:非空即打开(携带 SVG 源码;Mermaid 也渲染成 SVG 后进入) */
  zoomSvg: string | null;
  /** 开发模式:错误自动写日志,状态栏红点提示 */
  hasNewError: boolean;
  /** 当前文件在磁盘上被外部修改(且本地有未保存修改) */
  externalModified: boolean;
  /** 状态栏提示信息(如 AI 任务进行中) */
  notice: string | null;
  /** 右侧面板当前标签页 */
  rightTab: "inspector" | "ai";
  /** 项目状态 */
  projectRoot: string | null;
  fileTree: FileNode[];
  expandedPaths: string[];

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setEditMode: (mode: EditMode) => void;
  setCurrentFile: (path: string | null) => void;
  setDirty: (dirty: boolean) => void;
  toggleExplorer: () => void;
  toggleInspector: () => void;
  setInspectorContext: (ctx: InspectorContext) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setPrintDialogOpen: (open: boolean) => void;
  setSearchPanelOpen: (open: boolean) => void;
  setGitHistoryPath: (path: string | null) => void;
  setLogPanelOpen: (open: boolean) => void;
  setZoomSvg: (svg: string | null) => void;
  markError: () => void;
  clearError: () => void;
  setRightTab: (tab: "inspector" | "ai") => void;
  setExternalModified: (v: boolean) => void;
  setNotice: (notice: string | null) => void;
  setProject: (root: string | null, tree: FileNode[]) => void;
  setFileTree: (tree: FileNode[]) => void;
  toggleExpanded: (path: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: "light",
  editMode: "visual",
  currentFilePath: null,
  dirty: false,
  showExplorer: true,
  showInspector: true,
  inspectorContext: null,
  commandPaletteOpen: false,
  settingsOpen: false,
  printDialogOpen: false,
  searchPanelOpen: false,
  gitHistoryPath: null,
  logPanelOpen: false,
  zoomSvg: null,
  hasNewError: false,
  externalModified: false,
  notice: null,
  rightTab: "inspector",
  projectRoot: null,
  fileTree: [],
  expandedPaths: [],

  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
  setEditMode: (editMode) => set({ editMode }),
  setCurrentFile: (currentFilePath) => set({ currentFilePath }),
  setDirty: (dirty) => set({ dirty }),
  toggleExplorer: () => set((s) => ({ showExplorer: !s.showExplorer })),
  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
  setInspectorContext: (inspectorContext) => set({ inspectorContext }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPrintDialogOpen: (printDialogOpen) => set({ printDialogOpen }),
  setSearchPanelOpen: (searchPanelOpen) => set({ searchPanelOpen }),
  setGitHistoryPath: (gitHistoryPath) => set({ gitHistoryPath }),
  setLogPanelOpen: (logPanelOpen) => set({ logPanelOpen }),
  setZoomSvg: (zoomSvg) => set({ zoomSvg }),
  markError: () => set({ hasNewError: true }),
  clearError: () => set({ hasNewError: false }),
  setRightTab: (rightTab) => set({ rightTab }),
  setExternalModified: (externalModified) => set({ externalModified }),
  setNotice: (notice) => set({ notice }),
  setProject: (projectRoot, fileTree) =>
    set({ projectRoot, fileTree, expandedPaths: projectRoot ? [projectRoot] : [] }),
  setFileTree: (fileTree) => set({ fileTree }),
  toggleExpanded: (path) =>
    set((s) => ({
      expandedPaths: s.expandedPaths.includes(path)
        ? s.expandedPaths.filter((p) => p !== path)
        : [...s.expandedPaths, path],
    })),
}));
