/**
 * EditorController:连接 UI 操作(打开/保存)与 Tiptap Editor 实例。
 * Editor 实例由 VeloraEditor 挂载时注册。
 */
import type { Editor } from "@tiptap/react";
import { Fragment } from "@tiptap/pm/model";
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
import { useRecentStore } from "../settings/recentStore";

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
  (window as unknown as { __velora: Record<string, unknown> }).__velora = {
    getEditor,
    previewAiContent,
    previewReplaceHeading,
  };
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

/** 打开指定路径的文件(Project Explorer 点击 / 拖拽 / 单开);带未保存守卫 */
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
    void ensureProjectCoversFile(path);
    store2.setNotice(null);
  } catch (e) {
    const msg = `打开文件失败:${String(e)}`;
    console.error("[velora]", msg);
    store2.setNotice(msg);
    store2.markError();
    void logError(e, `打开文件 ${path}`);
  }
}

/**
 * 拖拽/单开的文件不在当前项目内时,自动把其所在目录设为项目根,
 * 让左侧资源树直接展示该文件夹(用户不用再手动「打开文件夹」)。
 */
async function ensureProjectCoversFile(filePath: string): Promise<void> {
  const { projectRoot, setProject } = useAppStore.getState();
  const inside =
    projectRoot !== null &&
    (filePath.startsWith(projectRoot + "/") || filePath === projectRoot);
  if (inside) return;
  const root = filePath.slice(0, filePath.lastIndexOf("/"));
  if (!root) return;
  try {
    const tree = await readDirTree(root);
    setProject(root, tree);
    void startWatching(root);
    if (!useAppStore.getState().showExplorer) {
      useAppStore.getState().toggleExplorer();
    }
  } catch (e) {
    // 目录读不了(已删除等):不打断打开流程
    console.warn("[velora] 设为项目根失败:", e);
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
  useRecentStore.getState().addRecent(path);
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
  const manager = editorInstance.storage.markdown?.manager;
  if (!manager) return false;

  // 1. 先解析内容备好(不动文档)
  const docJson = manager.parse(content) as { content?: import("@tiptap/core").JSONContent[] };
  const contentNodes = docJson?.content ?? [];
  if (contentNodes.length === 0) return false;

  // 2. 清旧预览(文档变小,旧位置失效)
  revertPendingPreviews();

  // 3. 用清后的最新文档定位:selection/atEnd/标题都要重读,否则越界
  let insertPos: number;
  if (locate?.afterHeading) {
    const found = findHeadingEnd(locate.afterHeading);
    insertPos = found ?? editorInstance.state.selection.to;
  } else if (locate?.atEnd) {
    insertPos = editorInstance.state.doc.content.size;
  } else {
    insertPos = editorInstance.state.selection.to;
  }

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

/**
 * 恢复所有未应用的 AI 预览(新一轮建议生成前调用)。
 * 关键:不是删除,而是 revert——
 * - 含 aiDelete 的预览(替换类):解开 aiDelete 恢复原文,丢弃新内容
 * - 纯追加预览:直接删(没有原文被动过)
 * 这样每轮 diff 的基线始终是原始文档,多轮修改不丢内容。
 * 实现上每个预览独立一个 transaction,避免事务内位置偏移的坑。
 */
function revertPendingPreviews(): void {
  if (!editorInstance) return;
  // 循环直到没有预览(每次处理一个,事务隔离保证位置准确)
  for (let i = 0; i < 20; i++) {
    const doc = editorInstance.state.doc;
    let target: number | null = null;
    doc.descendants((node, pos) => {
      if (target === null && node.type.name === "aiPreview") target = pos;
      return target === null;
    });
    if (target === null) break;
    const previewPos = target as number;
    editorInstance
      .chain()
      .command(({ tr, state }) => {
        const preview = state.doc.nodeAt(previewPos);
        if (!preview || preview.type.name !== "aiPreview") return false;
        // 从后往前:aiDelete 解开(恢复原文),aiNew 删(丢建议),其余保留
        const ops: { pos: number; kind: "del" | "unwrap" }[] = [];
        preview.forEach((child, offset) => {
          if (child.type.name === "aiDelete") ops.push({ pos: previewPos + 1 + offset, kind: "unwrap" });
          if (child.type.name === "aiNew") ops.push({ pos: previewPos + 1 + offset, kind: "del" });
        });
        for (const op of ops.reverse()) {
          const node = tr.doc.nodeAt(op.pos);
          if (!node) continue;
          if (op.kind === "del") tr.delete(op.pos, op.pos + node.nodeSize);
          else tr.replaceWith(op.pos, op.pos + node.nodeSize, node.content);
        }
        // 容器解开(此时只剩恢复的原文或空)
        const cur = tr.doc.nodeAt(previewPos);
        if (cur && cur.type.name === "aiPreview") {
          tr.replaceWith(previewPos, previewPos + cur.nodeSize, cur.content);
        }
        return true;
      })
      .run();
  }
}

/** 导出给 AI 的干净文档 markdown(剥离未应用预览块,基线=原文) */
export function getCleanMarkdownForAi(): string {
  if (!editorInstance) return "";
  const manager = editorInstance.storage.markdown?.manager;
  if (!manager) return editorInstance.getMarkdown();
  // 临时 revert 预览 → 序列化 → 撤销 revert(用 undo 保证文档状态完全还原)
  revertPendingPreviews();
  const md = editorInstance.getMarkdown();
  // revert 是一次编辑事务,undo 恢复预览块
  editorInstance.commands.undo();
  return md;
}

/**
 * 当前未应用预览里的建议内容(AI 多轮对话的上下文)。
 * 返回每条建议的定位 + 内容摘要。
 */
export function getPendingSuggestions(): Array<{
  locate: string;
  content: string;
}> {
  if (!editorInstance) return [];
  const out: Array<{ locate: string; content: string }> = [];
  editorInstance.state.doc.descendants((node) => {
    if (node.type.name !== "aiPreview") return;
    // 收集建议内容:跳过 aiDelete(那是原文)
    const parts: string[] = [];
    node.descendants((child) => {
      if (child.type.name === "aiNew") {
        parts.push(child.textContent);
      } else if (child.type.name !== "aiDelete" && child.isBlock && child.childCount === 0) {
        // 无 aiNew 包裹的纯追加预览,内容就是子块
      }
    });
    if (parts.length === 0 && node.content.size > 0) {
      // 纯追加预览(无 aiDelete/aiNew 标记):整个内容即建议
      let markerCount = 0;
      node.descendants((c) => {
        if (c.type.name === "aiDelete" || c.type.name === "aiNew") markerCount++;
        return true;
      });
      if (markerCount === 0) {
        node.forEach((child) => parts.push(child.textContent));
      }
    }
    if (parts.length > 0) {
      out.push({ locate: "未应用的建议", content: parts.join("\n").slice(0, 1500) });
    }
  });
  return out;
}

/** 找到标题所在块的范围 {from, to}(从标题到下一个同级/更高级标题前) */
function findHeadingRange(headingText: string): { from: number; to: number } | null {
  if (!editorInstance) return null;
  const doc = editorInstance.state.doc;
  let headingPos: number | null = null;
  let headingLevel = 0;
  doc.descendants((node, pos) => {
    if (headingPos !== null) return false;
    if (node.type.name === "heading" && node.textContent.includes(headingText)) {
      headingPos = pos;
      headingLevel = node.attrs.level as number;
    }
  });
  if (headingPos === null) return null;
  let end = doc.content.size;
  doc.descendants((node, pos) => {
    if (pos <= (headingPos as number)) return;
    if (node.type.name === "heading" && (node.attrs.level as number) <= headingLevel) {
      end = pos;
      return false;
    }
  });
  return { from: headingPos, to: end };
}

/**
 * 替换章节预览:旧内容包 aiDelete(红标删除),新内容其后,一起包 aiPreview 插回原位。
 * 应用:删 aiDelete + 解开 aiPreview(新内容转正);拒绝:解开 aiDelete(旧恢复)+ 删 aiPreview。
 */
export function previewReplaceHeading(
  content: string,
  headingText: string,
): boolean {
  if (!editorInstance) return false;
  const manager = editorInstance.storage.markdown?.manager;
  if (!manager) return false;

  // 1. 先解析新内容备好(不动文档)
  const docJson = manager.parse(content) as { content?: import("@tiptap/core").JSONContent[] };
  const newNodes = docJson?.content ?? [];
  if (newNodes.length === 0) return false;

  // 2. 清旧预览(也清掉 aiPreview 里的标题,避免干扰定位;位置需在清后重算)
  revertPendingPreviews();

  // 3. 清后定位 + 取旧内容(用最新文档)
  const range = findHeadingRange(headingText);
  if (!range) return false;
  const doc = editorInstance.state.doc;
  const oldContent = doc.slice(range.from, range.to).content.toJSON() as import("@tiptap/core").JSONContent[];

  editorInstance
    .chain()
    .command(({ tr, state }) => {
      const previewType = state.schema.nodes.aiPreview;
      const deleteType = state.schema.nodes.aiDelete;
      const newType = state.schema.nodes.aiNew;
      if (!previewType || !deleteType || !newType) return false;
      // 旧内容包 aiDelete(红),新内容包 aiNew(绿),一起进 aiPreview
      const delNode = deleteType.create(null, Fragment.fromJSON(state.schema, oldContent));
      const newNode = newType.create(null, Fragment.fromJSON(state.schema, newNodes));
      const previewNode = previewType.create(
        null,
        Fragment.fromArray([delNode, newNode]),
      );
      tr.replaceWith(range.from, range.to, previewNode);
      return true;
    })
    .run();
  setTimeout(() => {
    document.querySelector(".vl-ai-preview")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
  useAppStore.getState().setDirty(true);
  return true;
}
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
