/**
 * EditorController:连接 UI 操作(打开/保存)与 Tiptap Editor 实例。
 * Editor 实例由 VeloraEditor 挂载时注册。
 */
import type { Editor } from "@tiptap/react";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  openMarkdownFile,
  saveMarkdownFile,
  exportTextFile,
  readTextFile,
} from "../platform/fileService";
import {
  isMarkdownPath,
  pickFolder,
  readDirTree,
} from "../platform/projectService";
import { notifySelfWriteStart, startWatching } from "../platform/fileWatcher";
import { clearRecoveryDraft, saveRecoveryDraft } from "../platform/recoveryService";
import { logError } from "../platform/logService";
import { useAppStore } from "../state/appStore";
import { usePrefsStore } from "../settings/prefsStore";

let editorInstance: Editor | null = null;

/** 程序化 setContent 期间为 true:不标脏、不触发自动保存 */
let programmaticUpdate = false;

export function isProgrammaticUpdate(): boolean {
  return programmaticUpdate;
}

export function registerEditor(editor: Editor | null) {
  editorInstance = editor;
}

export function getEditor(): Editor | null {
  return editorInstance;
}

// e2e / 调试钩子
if (typeof window !== "undefined") {
  (window as unknown as { __velora: unknown }).__velora = { getEditor };
}
// ── Source Mode 同步 ──────────────────────────────────────
let sourceDraft = "";

export function getSourceDraft(): string {
  return sourceDraft;
}

export function setSourceDraft(value: string) {
  sourceDraft = value;
  useAppStore.getState().setDirty(true);
}

/** 切换 Visual / Source 模式,负责双向序列化同步 */
export function switchEditMode(mode: "visual" | "source") {
  const store = useAppStore.getState();
  if (store.editMode === mode) return;
  if (mode === "source") {
    sourceDraft = editorInstance?.getMarkdown() ?? "";
  } else if (editorInstance) {
    editorInstance.commands.setContent(sourceDraft, { contentType: "markdown" });
  }
  store.setEditMode(mode);
}

export async function openFile(): Promise<void> {
  const file = await openMarkdownFile();
  if (!file) return;
  await loadFileIntoEditor(file.path, file.content);
}

/** 打开指定路径的文件(Project Explorer 点击);带未保存守卫 */
export async function openFilePath(path: string): Promise<void> {
  if (!isMarkdownPath(path)) return;
  const store = useAppStore.getState();
  if (store.currentFilePath === path) return;

  if (store.dirty) {
    const proceed = await ask(
      "当前文档有未保存的修改,切换文件将丢弃这些修改。",
      { title: "未保存的修改", okLabel: "丢弃并打开", cancelLabel: "取消", kind: "warning" },
    );
    if (!proceed) return;
  }

  const store2 = useAppStore.getState();
  try {
    const content = await readTextFile(path);
    await loadFileIntoEditor(path, content);
    store2.setNotice(null);
  } catch (e) {
    const msg = `打开文件失败:${String(e)}`;
    console.error("[velora]", msg);
    store2.setNotice(msg);
    store2.markError();
    void logError(e, `打开文件 ${path}`);
  }
}

async function loadFileIntoEditor(path: string, content: string): Promise<void> {
  // 源码模式下先切回视觉,避免草稿串味
  if (useAppStore.getState().editMode === "source") {
    useAppStore.getState().setEditMode("visual");
  }
  if (!editorInstance) {
    useAppStore.getState().setNotice("编辑器尚未就绪,请稍后再试");
    return;
  }
  programmaticUpdate = true;
  try {
    editorInstance.commands.setContent(content, { contentType: "markdown" });
  } catch (e) {
    void logError(e, `解析文档失败(位置越界等)`);
    useAppStore.getState().setNotice(`文档解析失败,已记录日志(⌘D 查看)。可尝试源码模式 ⌘/ 编辑`);
    useAppStore.getState().markError();
  } finally {
    programmaticUpdate = false;
  }
  useAppStore.getState().setCurrentFile(path);
  useAppStore.getState().setDirty(false);
  useAppStore.getState().setExternalModified(false);
}

/** 加载 markdown 到编辑器(恢复草稿等场景,不关联文件路径) */
export function loadMarkdownIntoEditor(markdown: string): void {
  if (!editorInstance) return;
  programmaticUpdate = true;
  try {
    editorInstance.commands.setContent(markdown, { contentType: "markdown" });
  } finally {
    programmaticUpdate = false;
  }
  useAppStore.getState().setDirty(true);
}

/** 把 AI 回复插入为编辑区预览块(带背景色,可就地 应用/拒绝) */
export function previewAiContent(
  content: string,
  locate?: { afterHeading?: string; atEnd?: boolean },
): boolean {
  if (!editorInstance) return false;
  // 解析走 extension storage 的 MarkdownManager(editor.markdown 属性不可靠)
  const manager = editorInstance.storage.markdown?.manager;
  if (!manager) return false;

  // 定位:目标标题末尾 > 文档末尾(at-end)> 光标处
  let insertPos = editorInstance.state.selection.to;
  if (locate?.afterHeading) {
    const found = findHeadingEnd(locate.afterHeading);
    if (found !== null) insertPos = found;
  } else if (locate?.atEnd) {
    insertPos = editorInstance.state.doc.content.size;
  }

  const docJson = manager.parse(content) as { content?: import("@tiptap/core").JSONContent[] };
  const contentNodes = docJson?.content ?? [];
  if (contentNodes.length === 0) return false;
  editorInstance
    .chain()
    .insertContentAt(insertPos, {
      type: "aiPreview",
      content: contentNodes,
    })
    .run();
  // 滚到预览块
  setTimeout(() => {
    const el = document.querySelector(".vl-ai-preview");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
  useAppStore.getState().setDirty(true);
  return true;
}

/** 找到标题所在块的结束位置(该标题子树末尾 = 下一个同级/更高级标题前) */
function findHeadingEnd(headingText: string): number | null {
  if (!editorInstance) return null;
  const doc = editorInstance.state.doc;
  let foundPos: number | null = null;
  let foundLevel = 0;
  doc.descendants((node, pos) => {
    if (foundPos !== null) return false;
    if (node.type.name === "heading" && node.textContent.includes(headingText)) {
      foundPos = pos;
      foundLevel = node.attrs.level as number;
    }
  });
  if (foundPos === null) return null;
  // 找下一个同级或更高级标题,插到它前面
  let end = doc.content.size;
  let started = false;
  doc.descendants((node, pos) => {
    if (pos <= (foundPos as number)) return;
    if (!started) { started = true; return; }
    if (node.type.name === "heading" && (node.attrs.level as number) <= foundLevel) {
      end = pos;
      return false;
    }
  });
  return end;
}

/**
 * 把 AI 回复内容应用到编辑区(ADR-004:经 markdown 解析为 Document 节点)。
 * - insert:插入到当前光标处
 * - replace:替换当前选区(无选区时等同插入光标处)
 */
export function applyAiContent(
  content: string,
  mode: "insert" | "replace",
): boolean {
  if (!editorInstance) return false;
  const { selection } = editorInstance.state;
  const { from, to } = selection;
  const hasSelection = to > from;
  programmaticUpdate = true;
  try {
    if (mode === "replace" && hasSelection) {
      editorInstance.commands.insertContentAt({ from, to }, content, {
        contentType: "markdown",
      });
    } else {
      editorInstance.commands.insertContentAt(to, `\n\n${content}\n\n`, {
        contentType: "markdown",
      });
    }
  } finally {
    programmaticUpdate = false;
  }
  useAppStore.getState().setDirty(true);
  scheduleAutoSave();
  return true;
}

/** 重新加载当前文件(外部修改后);本地未保存修改会被覆盖 */
export async function reloadCurrentFile(): Promise<void> {
  const { currentFilePath } = useAppStore.getState();
  if (!currentFilePath) return;
  try {
    const content = await readTextFile(currentFilePath);
    await loadFileIntoEditor(currentFilePath, content);
  } catch {
    // 文件可能已被删除,保持现状
  }
}

// ── Project Explorer ──────────────────────────────────────

/** 打开文件夹作为项目根 */
export async function openProject(): Promise<void> {
  const root = await pickFolder();
  if (!root) return;
  const tree = await readDirTree(root);
  useAppStore.getState().setProject(root, tree);
  void startWatching(root);
  if (!useAppStore.getState().showExplorer) {
    useAppStore.getState().toggleExplorer();
  }
}

/** 刷新文件树(保留展开状态) */
export async function refreshFileTree(): Promise<void> {
  const { projectRoot, setFileTree } = useAppStore.getState();
  if (!projectRoot) return;
  setFileTree(await readDirTree(projectRoot));
}

export async function saveFile(): Promise<void> {
  if (!editorInstance) return;
  const markdown = editorInstance.getMarkdown();
  const { currentFilePath, setCurrentFile, setDirty, setExternalModified } =
    useAppStore.getState();
  // 挂起监听重载:吸收本次写盘产生的 fs 回声,避免触发"外部修改"死循环
  notifySelfWriteStart();
  const savedPath = await saveMarkdownFile(currentFilePath, markdown);
  if (savedPath) {
    setCurrentFile(savedPath);
    setDirty(false);
    setExternalModified(false);
    // 已存盘,磁盘是真相,清恢复草稿
    void clearRecoveryDraft();
  }
}

// ── 自动保存 ──────────────────────────────────────────────
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** 编辑停顿后自动保存:
 *  - 已存盘文档 → 原子写盘 + 清恢复草稿(磁盘是真相)
 *  - 未存盘文档 → 存恢复草稿到 app data(崩溃可恢复)
 *  - 自动保存关闭 → 未存盘文档仍存恢复草稿(防数据丢失) */
export function scheduleAutoSave(): void {
  const { autoSave, autoSaveDelay } = usePrefsStore.getState();
  const { currentFilePath } = useAppStore.getState();
  // 已存盘文档只在自动保存开启时调度;未存盘文档无论开关都存草稿(数据安全底线)
  if (currentFilePath && !autoSave) return;
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    if (!editorInstance) return;
    if (currentFilePath) {
      await saveFile();
      void clearRecoveryDraft();
    } else {
      // 未存盘:存恢复草稿
      const markdown = editorInstance.getMarkdown();
      void saveRecoveryDraft(markdown);
    }
  }, autoSaveDelay);
}

/** 导出 HTML(Mermaid/SVG 内联渲染) */
export async function exportHtml(): Promise<void> {
  if (!editorInstance) return;
  const { buildHtmlDocument } = await import("../export/exportHtml");
  const { theme, currentFilePath } = useAppStore.getState();
  const html = await buildHtmlDocument(editorInstance.getJSON(), {
    theme,
    currentFilePath,
  });
  await exportTextFile("document.html", html);
}

/** 打印 / 导出 PDF:生成打印 HTML,临时文件 + 系统默认程序打开 →
 *  浏览器原生打印对话框存 PDF(原生质量、分页、纸张)。 */
export async function exportPrint(
  paperSize: "A4" | "letter",
  orientation: "portrait" | "landscape",
): Promise<void> {
  if (!editorInstance) return;
  if (!("__TAURI_INTERNALS__" in window)) {
    useAppStore.getState().setNotice("打印需在桌面应用中运行(pnpm tauri dev)");
    return;
  }
  const { buildPrintHtml } = await import("../export/exportPrint");
  const { theme, currentFilePath, setNotice } = useAppStore.getState();
  setNotice("正在生成打印文档…");
  try {
    const html = await buildPrintHtml(editorInstance.getJSON(), {
      theme,
      currentFilePath,
      paperSize,
      orientation,
    });
    // 写临时文件,用系统默认程序打开(浏览器预览 → 用户存 PDF)
    const { writeFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const { openPath } = await import("@tauri-apps/plugin-opener");
    const stamp = Date.now();
    const fileName = `velora-print-${stamp}.html`;
    await writeFile(fileName, new TextEncoder().encode(html), {
      baseDir: BaseDirectory.Temp,
    });
    // 读取临时文件绝对路径给 openPath
    const { tempDir } = await import("@tauri-apps/api/path");
    const tmpDir = await tempDir();
    await openPath(tmpDir + fileName);
    setNotice(null);
  } catch (e) {
    setNotice(`打印失败:${e instanceof Error ? e.message : String(e)}`);
  }
}
