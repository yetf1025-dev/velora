import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { GripVertical, Trash2 } from "lucide-react";
import { useAppStore } from "../state/appStore";

interface HandleState {
  /** 顶层块位置 */
  pos: number;
  /** 相对编辑容器的偏移 */
  top: number;
  left: number;
}

/**
 * 块操作手柄(Notion 风格):鼠标悬停某一块时,在其左侧浮现。
 * 点击弹出格式调整菜单:转换为 正文/标题/引用/列表/代码块,或删除该块。
 */
export function BlockHandle({
  editor,
  containerRef,
}: {
  editor: Editor;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [handle, setHandle] = useState<HandleState | null>(null);
  const handlePosRef = useRef<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!menuOpen) {
        setHandle(null);
        handlePosRef.current = null;
      }
    }, 300);
  }, [menuOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      const posInfo = editor.view.posAtCoords({
        left: e.clientX,
        top: e.clientY,
      });
      if (!posInfo) {
        scheduleHide();
        return;
      }
      const $pos = editor.state.doc.resolve(posInfo.pos);
      if ($pos.depth < 1) {
        scheduleHide();
        return;
      }
      // 取顶层块(列表整体/表格整体/引用整体),避免列表项内段落抖动
      const topPos = $pos.before(1);
      const topNode = $pos.node(1);
      if (!topNode) {
        scheduleHide();
        return;
      }
      // 表格不显示工具栏(表格有自己的编辑交互,块手柄会干扰)
      if (topNode.type.name === "table") {
        scheduleHide();
        return;
      }
      const dom = editor.view.nodeDOM(topPos) as HTMLElement | null;
      if (!dom) {
        scheduleHide();
        return;
      }
      // 同一块内移动不重设(避免子元素抖动闪烁)
      if (handlePosRef.current === topPos) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        return;
      }
      if (hideTimer.current) clearTimeout(hideTimer.current);
      const containerRect = container.getBoundingClientRect();
      const domRect = dom.getBoundingClientRect();
      handlePosRef.current = topPos;
      setHandle({
        pos: topPos,
        top: domRect.top - containerRect.top + 2,
        left: domRect.left - containerRect.left - 28,
      });
    };

    const onLeave = () => scheduleHide();

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [editor, containerRef, scheduleHide]);

  if (!handle) return null;

  /** 让命令作用于手柄指向的块 */
  const focusBlock = () => {
    editor.commands.setTextSelection(handle.pos + 1);
  };

  const node = editor.state.doc.nodeAt(handle.pos);
  const nodeKind = node?.type.name;

  /** 按块类型生成菜单项。特殊块(代码/svg/mermaid/toc)不给出"转标题/列表"
   *  这类无意义操作,改为该块专属动作 + 复制/删除。 */
  const buildActions = (): { label: string; shortcut?: string; run: () => void; danger?: boolean }[] => {
    const convert: { label: string; shortcut: string; run: () => void }[] = [
      { label: "正文", shortcut: "⌘0", run: () => editor.commands.setParagraph() },
      { label: "一级标题", shortcut: "⌘1", run: () => editor.commands.setNode("heading", { level: 1 }) },
      { label: "二级标题", shortcut: "⌘2", run: () => editor.commands.setNode("heading", { level: 2 }) },
      { label: "三级标题", shortcut: "⌘3", run: () => editor.commands.setNode("heading", { level: 3 }) },
      { label: "引用", shortcut: "⌘⌥Q", run: () => editor.commands.toggleBlockquote() },
      { label: "无序列表", shortcut: "⌘⌥U", run: () => editor.commands.toggleBulletList() },
      { label: "有序列表", shortcut: "⌘⌥O", run: () => editor.commands.toggleOrderedList() },
      { label: "任务列表", shortcut: "⌘⌥T", run: () => editor.commands.toggleTaskList() },
      { label: "代码块", shortcut: "⌘⌥C", run: () => editor.commands.toggleCodeBlock() },
    ];

    // 代码块:语言切换(常用)+ 转正文
    if (nodeKind === "codeBlock") {
      return [
        { label: "转为正文", run: () => editor.commands.setParagraph() },
        { label: "语言: TypeScript", run: () => { focusBlock(); editor.commands.updateAttributes("codeBlock", { language: "typescript" }); } },
        { label: "语言: JavaScript", run: () => { focusBlock(); editor.commands.updateAttributes("codeBlock", { language: "javascript" }); } },
        { label: "语言: Python", run: () => { focusBlock(); editor.commands.updateAttributes("codeBlock", { language: "python" }); } },
        { label: "语言: Bash", run: () => { focusBlock(); editor.commands.updateAttributes("codeBlock", { language: "bash" }); } },
        { label: "语言: Rust", run: () => { focusBlock(); editor.commands.updateAttributes("codeBlock", { language: "rust" }); } },
      ];
    }
    // Mermaid:Inspector 主题/AI 已有,这里给快速主题切换 + 复制源码 + 删除
    if (nodeKind === "mermaid") {
      const source = (node?.attrs.source as string) ?? "";
      return [
        { label: "复制 Mermaid 源码", run: () => void navigator.clipboard.writeText(source) },
        { label: "主题: Modern", run: () => { focusBlock(); editor.commands.updateAttributes("mermaid", { theme: "velora-modern" }); } },
        { label: "主题: Minimal", run: () => { focusBlock(); editor.commands.updateAttributes("mermaid", { theme: "velora-minimal" }); } },
        { label: "主题: Dark", run: () => { focusBlock(); editor.commands.updateAttributes("mermaid", { theme: "velora-dark" }); } },
        { label: "主题: 自动(跟随文档)", run: () => { focusBlock(); editor.commands.updateAttributes("mermaid", { theme: null }); } },
      ];
    }
    // SVG:画布编辑(打开 Inspector)/ 复制源码 / 删除
    if (nodeKind === "svgBlock") {
      const openInspector = () => {
        const s = useAppStore.getState();
        s.setRightTab("inspector");
        if (!s.showInspector) s.toggleInspector();
      };
      return [
        { label: "画布编辑(右侧 Inspector)", run: openInspector },
        { label: "复制 SVG 源码", run: () => void navigator.clipboard.writeText(((node?.attrs.source as string) ?? node?.attrs.src ?? "")) },
      ];
    }
    // TOC / 折叠块:只给删除类操作,转换无意义
    if (nodeKind === "toc" || nodeKind === "details") {
      return [];
    }
    // 默认:文本类块给转换菜单
    return convert;
  };

  const actions = buildActions();

  const runAction = (run: () => void) => {
    focusBlock();
    run();
  };

  const deleteBlock = () => {
    const node = editor.state.doc.nodeAt(handle.pos);
    if (!node) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: handle.pos, to: handle.pos + node.nodeSize })
      .run();
    setHandle(null);
  };

  return (
    <div
      className="vl-block-handle"
      style={{ top: handle.top, left: handle.left }}
      onMouseEnter={() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      }}
      onMouseLeave={scheduleHide}
    >
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="vl-block-handle-btn" title="块操作">
            <GripVertical size={14} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="vl-context-menu" sideOffset={4} align="start">
            {actions.map((a) => (
              <DropdownMenu.Item
                key={a.label}
                className="vl-context-item"
                onSelect={() => runAction(a.run)}
              >
                <span>{a.label}</span>
                {a.shortcut && <span className="vl-context-shortcut">{a.shortcut}</span>}
              </DropdownMenu.Item>
            ))}
            {actions.length > 0 && (
              <DropdownMenu.Separator className="vl-context-separator" />
            )}
            <DropdownMenu.Item
              className="vl-context-item"
              onSelect={deleteBlock}
            >
              <span
                style={{
                  color: "var(--vl-danger)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Trash2 size={12} />
                删除本块
              </span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
