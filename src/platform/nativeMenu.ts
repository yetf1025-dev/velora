/**
 * macOS 原生菜单栏(ADR-003:菜单只是系统能力的入口,动作全走前端服务层)。
 * 快捷键由原生菜单自动标注;编辑器内 PM 快捷键(FormattingKeymap)作为
 * 浏览器开发模式(pnpm dev)的回退。
 *
 * 菜单动作用 setNode/toggle 等幂等或半幂等命令,避免与 PM 快捷键双触发。
 */
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { getEditor, openFile, openProject, saveFile, exportHtml, switchEditMode } from "../editor/editorController";
import { useAppStore } from "../state/appStore";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

async function item(
  text: string,
  action: () => void,
  accelerator?: string,
): Promise<MenuItem> {
  return MenuItem.new({ id: text, text, accelerator, action: () => action() });
}

async function separator() {
  return PredefinedMenuItem.new({ item: "Separator" });
}

export async function setupNativeMenu(): Promise<void> {
  // 浏览器开发模式下没有原生菜单
  if (!("__TAURI_INTERNALS__" in window)) return;

  const editor = () => getEditor();
  const store = useAppStore.getState;

  // ── 文件 ─────────────────────────────────────────────
  const fileMenu = await Submenu.new({
    text: "文件",
    items: [
      await item("打开文件…", () => void openFile(), "CmdOrCtrl+O"),
      await item("打开文件夹…", () => void openProject()),
      await separator(),
      await item("保存", () => void saveFile(), "CmdOrCtrl+S"),
      await item("导出 HTML…", () => void exportHtml()),
      await item("打印 / 导出 PDF…", () => store().setPrintDialogOpen(true), "CmdOrCtrl+P"),
      await separator(),
      await item("设置…", () => store().setSettingsOpen(true), "CmdOrCtrl+,"),
    ],
  });

  // ── 编辑 ─────────────────────────────────────────────
  const editMenu = await Submenu.new({
    text: "编辑",
    items: [
      await item("撤销", () => editor()?.commands.undo(), "CmdOrCtrl+Z"),
      await item("重做", () => editor()?.commands.redo(), "CmdOrCtrl+Shift+Z"),
      await separator(),
      await item("剪切", () => document.execCommand("cut"), "CmdOrCtrl+X"),
      await item("复制", () => document.execCommand("copy"), "CmdOrCtrl+C"),
      await item("粘贴", () => document.execCommand("paste"), "CmdOrCtrl+V"),
      await item("全选", () => editor()?.commands.selectAll(), "CmdOrCtrl+A"),
    ],
  });

  // ── 段落 ─────────────────────────────────────────────
  const paragraphItems: (MenuItem | PredefinedMenuItem)[] = [
    await item("正文", () => editor()?.commands.setParagraph(), "CmdOrCtrl+0"),
  ];
  const headingLabels = ["一", "二", "三", "四", "五", "六"];
  for (let level = 1; level <= 6; level++) {
    const lv = level as HeadingLevel;
    paragraphItems.push(
      await item(
        `${headingLabels[level - 1]}级标题`,
        // setNode 幂等:即使 PM 快捷键也触发,结果一致
        () => editor()?.commands.setNode("heading", { level: lv }),
        `CmdOrCtrl+${level}`,
      ),
    );
  }
  paragraphItems.push(
    await separator(),
    await item("引用", () => editor()?.commands.toggleBlockquote(), "CmdOrCtrl+Alt+Q"),
    await item("无序列表", () => editor()?.commands.toggleBulletList(), "CmdOrCtrl+Alt+U"),
    await item("有序列表", () => editor()?.commands.toggleOrderedList(), "CmdOrCtrl+Alt+O"),
    await item("任务列表", () => editor()?.commands.toggleTaskList(), "CmdOrCtrl+Alt+T"),
  );
  const paragraphMenu = await Submenu.new({ text: "段落", items: paragraphItems });

  // ── 格式 ─────────────────────────────────────────────
  const formatMenu = await Submenu.new({
    text: "格式",
    items: [
      await item("加粗", () => editor()?.commands.toggleBold(), "CmdOrCtrl+B"),
      await item("斜体", () => editor()?.commands.toggleItalic(), "CmdOrCtrl+I"),
      await item("下划线", () => editor()?.commands.toggleUnderline(), "CmdOrCtrl+U"),
      await item("删除线", () => editor()?.commands.toggleStrike(), "CmdOrCtrl+Shift+S"),
      await item("行内代码", () => editor()?.commands.toggleCode(), "CmdOrCtrl+E"),
      await separator(),
      await item("代码块", () => editor()?.commands.toggleCodeBlock(), "CmdOrCtrl+Alt+C"),
      await item("插入 Mermaid 图", () => editor()?.commands.insertMermaid(), "CmdOrCtrl+Alt+M"),
      await item("插入折叠块", () => editor()?.commands.insertDetails(), "CmdOrCtrl+Alt+D"),
      await item("插入目录", () => editor()?.commands.insertContent({ type: "toc" })),
    ],
  });

  // ── 显示 ─────────────────────────────────────────────
  const viewMenu = await Submenu.new({
    text: "显示",
    items: [
      await item("左侧面板", () => store().toggleExplorer(), "CmdOrCtrl+B"),
      await item("Inspector", () => store().toggleInspector(), "CmdOrCtrl+J"),
      await separator(),
      await item(
        "切换 视觉/源码 模式",
        () => switchEditMode(store().editMode === "visual" ? "source" : "visual"),
        "CmdOrCtrl+/",
      ),
      await item(
        "命令面板",
        () => store().setCommandPaletteOpen(!store().commandPaletteOpen),
        "CmdOrCtrl+K",
      ),
      await item(
        "全项目搜索",
        () => store().setSearchPanelOpen(!store().searchPanelOpen),
        "CmdOrCtrl+Shift+F",
      ),
      await item(
        "AI 对话",
        () => {
          const s = store();
          s.setRightTab("ai");
          if (!s.showInspector) s.toggleInspector();
        },
        "CmdOrCtrl+L",
      ),
      await separator(),
      await item("切换亮/暗主题", () => store().toggleTheme()),
    ],
  });

  const menu = await Menu.new({
    items: [fileMenu, editMenu, paragraphMenu, formatMenu, viewMenu],
  });
  await menu.setAsAppMenu();
}
