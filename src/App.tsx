import { useEffect, useState } from "react";
import { StatusBar } from "./components/StatusBar";
import { TitleBar } from "./components/TitleBar";
import { SourceEditor } from "./components/SourceEditor";
import { SidePanel } from "./components/SidePanel";
import { EditorContextMenu } from "./components/EditorContextMenu";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsDialog } from "./components/SettingsDialog";
import { PrintDialog } from "./components/PrintDialog";
import { AiDiffDialog } from "./inspector/AiDiffDialog";
import { RecoveryDialog } from "./components/RecoveryDialog";
import { SearchPanel } from "./components/SearchPanel";
import { LogPanel } from "./components/LogPanel";
import { installGlobalErrorCapture } from "./platform/logService";
import { loadRecoveryDraft, clearRecoveryDraft } from "./platform/recoveryService";
import { RightPanel } from "./components/RightPanel";
import { VeloraEditor } from "./editor/VeloraEditor";
import {
  openFile,
  refreshFileTree,
  saveFile,
  switchEditMode,
} from "./editor/editorController";
import { useAppStore } from "./state/appStore";
import { useGitStore } from "./state/gitStore";
import { matchShortcut } from "./settings/shortcutService";
import { setupNativeMenu } from "./platform/nativeMenu";

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const editMode = useAppStore((s) => s.editMode);
  const showExplorer = useAppStore((s) => s.showExplorer);
  const showInspector = useAppStore((s) => s.showInspector);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const printOpen = useAppStore((s) => s.printDialogOpen);
  const [recovery, setRecovery] = useState<string | null>(null);
  const searchOpen = useAppStore((s) => s.searchPanelOpen);
  const logOpen = useAppStore((s) => s.logPanelOpen);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // macOS 原生菜单栏(文件/编辑/段落/格式/显示)
  useEffect(() => {
    void setupNativeMenu();
  }, []);

  // 全局错误捕获:未处理异常写日志 + 状态栏红点
  useEffect(() => {
    installGlobalErrorCapture();
  }, []);

  // 启动时检测崩溃恢复草稿
  useEffect(() => {
    void loadRecoveryDraft().then((draft) => {
      if (draft) setRecovery(draft);
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = matchShortcut(e);
      if (!action) return;
      e.preventDefault();
      switch (action) {
        case "openFile":
          void openFile();
          break;
        case "saveFile":
          void saveFile();
          break;
        case "toggleExplorer":
          useAppStore.getState().toggleExplorer();
          break;
        case "toggleInspector":
          useAppStore.getState().toggleInspector();
          break;
        case "commandPalette":
          useAppStore
            .getState()
            .setCommandPaletteOpen(!useAppStore.getState().commandPaletteOpen);
          break;
        case "toggleSourceMode":
          switchEditMode(
            useAppStore.getState().editMode === "visual" ? "source" : "visual",
          );
          break;
        case "openSettings":
          useAppStore.getState().setSettingsOpen(true);
          break;
        case "toggleLog":
          useAppStore.getState().setLogPanelOpen(
            !useAppStore.getState().logPanelOpen,
          );
          break;
        case "search":
          useAppStore.getState().setSearchPanelOpen(
            !useAppStore.getState().searchPanelOpen,
          );
          break;
        case "toggleAiChat": {
          const s = useAppStore.getState();
          if (s.showInspector && s.rightTab === "ai") {
            s.toggleInspector();
          } else {
            s.setRightTab("ai");
            if (!s.showInspector) s.toggleInspector();
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 窗口重新聚焦时刷新文件树与 Git 状态(轻量方案,文件监听器后续接 tauri fs-watch)
  useEffect(() => {
    const onFocus = () => {
      void refreshFileTree();
      void useGitStore.getState().refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--vl-bg)" }}>
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        {showExplorer && <SidePanel />}
        <main className="min-w-0 flex-1" style={{ background: "var(--vl-editor-bg)" }}>
          {/* 视觉编辑器保持挂载以保留文档状态,源码模式仅隐藏 */}
          <EditorContextMenu>
            <div className="h-full">
              <div style={{ display: editMode === "visual" ? "contents" : "none" }}>
                <VeloraEditor />
              </div>
              {editMode === "source" && <SourceEditor />}
            </div>
          </EditorContextMenu>
        </main>
        {showInspector && <RightPanel />}
      </div>
      <StatusBar />
      <CommandPalette
        onOpenSettings={() => useAppStore.getState().setSettingsOpen(true)}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => useAppStore.getState().setSettingsOpen(open)}
      />
      <PrintDialog
        open={printOpen}
        onOpenChange={(open) => useAppStore.getState().setPrintDialogOpen(open)}
      />
      <AiDiffDialog />
      <SearchPanel
        open={searchOpen}
        onOpenChange={(o) => useAppStore.getState().setSearchPanelOpen(o)}
      />
      <LogPanel
        open={logOpen}
        onOpenChange={(o) => useAppStore.getState().setLogPanelOpen(o)}
      />
      <RecoveryDialog
        open={!!recovery}
        draft={recovery}
        onRecover={async () => {
          if (recovery) {
            const { loadMarkdownIntoEditor } = await import("./editor/editorController");
            loadMarkdownIntoEditor(recovery);
            useAppStore.getState().setCurrentFile(null);
          }
          setRecovery(null);
          void clearRecoveryDraft();
        }}
        onDiscard={() => {
          setRecovery(null);
          void clearRecoveryDraft();
        }}
        onClose={() => setRecovery(null)}
      />
    </div>
  );
}
