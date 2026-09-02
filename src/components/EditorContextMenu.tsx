import * as ContextMenu from "@radix-ui/react-context-menu";
import { useState, type ReactNode } from "react";
import { NodeSelection } from "@tiptap/pm/state";
import { getEditor } from "../editor/editorController";
import { renderDiagram } from "../diagram/engine";
import { resolveThemeId } from "../diagram/themes";
import { aiMermaidToSvg } from "../ai/aiService";
import { exportTextFile, readTextFile } from "../platform/fileService";
import { useAppStore } from "../state/appStore";
import { useAiChatStore } from "../ai/aiChatStore";
import { useSvgRefreshStore } from "../editor/extensions/svg/svgRefresh";
import { resolveRelative } from "../platform/assetPath";

/**
 * 编辑器右键菜单(替代浏览器默认菜单),按上下文变化:
 * - 选中 Mermaid / SVG 节点 → 节点专属操作(源码/导出/AI/画布/删除)
 * - 选中文字 → 剪贴板 + 添加到 AI 对话
 * - 其他 → 通用插入操作
 */
export function EditorContextMenu({ children }: { children: ReactNode }) {
  // 菜单打开时强制重渲染,确保读到最新选区
  const [, setTick] = useState(0);

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        if (open) setTick((t) => t + 1);
      }}
    >
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="vl-context-menu">
          <MenuBody />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function MenuBody() {
  const editor = getEditor();
  const selection = editor?.state.selection;
  const nodeSel =
    selection instanceof NodeSelection ? selection : null;
  const nodeKind = nodeSel?.node.type.name;

  if (nodeSel && nodeKind === "mermaid") {
    return <MermaidMenu pos={nodeSel.from} />;
  }
  if (nodeSel && nodeKind === "svgBlock") {
    return <SvgMenu pos={nodeSel.from} />;
  }
  return <GenericMenu />;
}

// ── Mermaid 节点菜单 ─────────────────────────────────────

function MermaidMenu({ pos }: { pos: number }) {
  const editor = getEditor();
  const node = editor?.state.doc.nodeAt(pos);
  if (!editor || !node) return null;
  const source = (node.attrs.source as string) ?? "";

  const copySource = () => void navigator.clipboard.writeText(source);

  const exportSvg = async () => {
    const theme = useAppStore.getState().theme;
    const themeId = resolveThemeId(node.attrs.theme as string | null, theme);
    const result = await renderDiagram(source, themeId);
    if (result.ok && result.svg) await exportTextFile("diagram.svg", result.svg);
  };

  /** AI 理解 Mermaid 语义后重新绘制 SVG 并替换当前节点。
   *  原始 Mermaid 源码以折叠块形式保留在下方。 */
  const convertToSvg = async () => {
    const { setNotice, theme } = useAppStore.getState();
    setNotice("AI 正在理解 Mermaid 并重新绘制 SVG…");
    try {
      const svg = await aiMermaidToSvg(source, theme);
      if (!svg.startsWith("<svg")) {
        throw new Error(`AI 返回的不是合法 SVG:${svg.slice(0, 120)}`);
      }
      editor
        .chain()
        .command(({ tr, state }) => {
          const target = state.doc.nodeAt(pos);
          const { schema } = state;
          const svgType = schema.nodes.svgBlock;
          const detailsType = schema.nodes.details;
          const codeType = schema.nodes.codeBlock;
          if (!target || !svgType) return false;

          const nodes = [
            svgType.create({ src: null, alt: null, source: svg }),
          ];
          if (detailsType && codeType) {
            nodes.push(
              detailsType.create(
                { summary: "原始 Mermaid 源码(转换自 Mermaid,可删除)", open: false },
                codeType.create({ language: "mermaid" }, schema.text(source)),
              ),
            );
          }
          tr.replaceWith(pos, pos + target.nodeSize, nodes);
          return true;
        })
        .run();
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  };

  const openInspector = () => {
    const s = useAppStore.getState();
    s.setRightTab("inspector");
    if (!s.showInspector) s.toggleInspector();
  };

  const deleteNode = () => editor.commands.deleteSelection();

  return (
    <>
      <Item onSelect={copySource}>复制 Mermaid 源码</Item>
      <Item onSelect={() => void exportSvg()}>导出 SVG</Item>
      <Item onSelect={() => void convertToSvg()}>转为 SVG(AI 重新绘制)</Item>
      <Item onSelect={openInspector}>主题 / AI 优化(Inspector)</Item>
      <ContextMenu.Separator className="vl-context-separator" />
      <Item danger onSelect={deleteNode}>删除该图表</Item>
    </>
  );
}

// ── SVG 节点菜单 ─────────────────────────────────────────

function SvgMenu({ pos }: { pos: number }) {
  const editor = getEditor();
  const node = editor?.state.doc.nodeAt(pos);
  if (!editor || !node) return null;
  const src = (node.attrs.src as string | null) ?? null;
  const inlineSource = (node.attrs.source as string | null) ?? null;

  const loadSource = async (): Promise<string> => {
    if (inlineSource !== null) return inlineSource;
    const currentFilePath = useAppStore.getState().currentFilePath;
    if (src && currentFilePath) {
      return readTextFile(resolveRelative(currentFilePath, src));
    }
    throw new Error("无法获取 SVG 源码");
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(await loadSource());
    } catch { /* 源不可读时静默 */ }
  };

  const exportSvg = async () => {
    try {
      await exportTextFile("image.svg", await loadSource());
    } catch { /* 同上 */ }
  };

  const openCanvas = () => {
    // 通知 SvgInspector 打开画布(它会读最新源码)
    useSvgRefreshStore.getState().requestCanvas();
    const s = useAppStore.getState();
    s.setRightTab("inspector");
    if (!s.showInspector) s.toggleInspector();
  };

  const deleteNode = () => editor.commands.deleteSelection();

  return (
    <>
      <Item onSelect={openCanvas}>画布编辑</Item>
      <Item onSelect={() => void copySource()}>复制 SVG 源码</Item>
      <Item onSelect={() => void exportSvg()}>导出 SVG</Item>
      <ContextMenu.Separator className="vl-context-separator" />
      <Item danger onSelect={deleteNode}>删除该图形</Item>
    </>
  );
}

// ── 通用菜单 ─────────────────────────────────────────────

function GenericMenu() {
  const editor = getEditor();

  const cut = () => document.execCommand("cut");
  const copy = () => document.execCommand("copy");
  const paste = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    if (text && editor) editor.view.pasteText(text);
  };
  const selectAll = () => editor?.commands.selectAll();

  const insertMermaid = () => editor?.commands.insertMermaid();
  const insertDetails = () => editor?.commands.insertDetails();
  const insertToc = () => editor?.commands.insertContent({ type: "toc" });

  const selectionText = (() => {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return to > from ? editor.state.doc.textBetween(from, to, "\n").trim() : "";
  })();

  const addToChat = () => {
    if (!selectionText) return;
    useAiChatStore.getState().addContext(selectionText);
    const s = useAppStore.getState();
    s.setRightTab("ai");
    if (!s.showInspector) s.toggleInspector();
  };

  // 当前打开文件的 Git 历史(相对项目根)
  const currentGitPath = (() => {
    const { currentFilePath, projectRoot } = useAppStore.getState();
    if (!currentFilePath || !projectRoot) return null;
    return currentFilePath.startsWith(projectRoot + "/")
      ? currentFilePath.slice(projectRoot.length + 1)
      : currentFilePath;
  })();

  return (
    <>
      <Item onSelect={cut} shortcut="⌘X">剪切</Item>
      <Item onSelect={copy} shortcut="⌘C">复制</Item>
      <Item onSelect={() => void paste()} shortcut="⌘V">粘贴</Item>
      <Item onSelect={selectAll} shortcut="⌘A">全选</Item>
      {selectionText && (
        <>
          <ContextMenu.Separator className="vl-context-separator" />
          <Item onSelect={addToChat}>添加到 AI 对话</Item>
        </>
      )}
      {currentGitPath && (
        <>
          <ContextMenu.Separator className="vl-context-separator" />
          <Item onSelect={() => useAppStore.getState().setGitHistoryPath(currentGitPath)}>
            查看 Git 历史
          </Item>
        </>
      )}
      <ContextMenu.Separator className="vl-context-separator" />
      <Item onSelect={insertMermaid}>插入 Mermaid 图</Item>
      <Item onSelect={insertDetails}>插入折叠块</Item>
      <Item onSelect={insertToc}>插入目录 (TOC)</Item>
      <ContextMenu.Separator className="vl-context-separator" />
      <Item onSelect={() => useAppStore.getState().toggleInspector()}>
        切换 Inspector
      </Item>
    </>
  );
}

function Item({
  children,
  onSelect,
  shortcut,
  danger,
}: {
  children: ReactNode;
  onSelect: () => void;
  shortcut?: string;
  danger?: boolean;
}) {
  return (
    <ContextMenu.Item className="vl-context-item" onSelect={onSelect}>
      <span style={danger ? { color: "var(--vl-danger)" } : undefined}>
        {children}
      </span>
      {shortcut && <span className="vl-context-shortcut">{shortcut}</span>}
    </ContextMenu.Item>
  );
}
