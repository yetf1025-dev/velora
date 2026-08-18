/**
 * 格式化快捷键(Typora 风格)。
 * 与全局快捷键(⌘O/⌘S/⌘K 等)不冲突:这些是编辑器内的文档格式化操作。
 */
import { Extension } from "@tiptap/core";

export const FormattingKeymap = Extension.create({
  name: "formattingKeymap",

  addKeyboardShortcuts() {
    const headings: Record<string, () => boolean> = {};
    for (let level = 1; level <= 6; level++) {
      headings[`Mod-${level}`] = () =>
        this.editor.commands.toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 });
    }

    return {
      ...headings,
      // 正文
      "Mod-0": () => this.editor.commands.setParagraph(),
      // 代码块
      "Mod-Alt-c": () => this.editor.commands.toggleCodeBlock(),
      // 引用块
      "Mod-Alt-q": () => this.editor.commands.toggleBlockquote(),
      // 列表
      "Mod-Alt-u": () => this.editor.commands.toggleBulletList(),
      "Mod-Alt-o": () => this.editor.commands.toggleOrderedList(),
      "Mod-Alt-t": () => this.editor.commands.toggleTaskList(),
      // 插入 Mermaid 图
      "Mod-Alt-m": () => this.editor.commands.insertMermaid(),
      // 插入折叠块
      "Mod-Alt-d": () => this.editor.commands.insertDetails(),
    };
  },
});
