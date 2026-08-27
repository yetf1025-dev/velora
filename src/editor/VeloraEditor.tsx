import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Mathematics } from "@tiptap/extension-mathematics";
import "katex/dist/katex.min.css";
import { Details } from "./extensions/details";
import { AiPreview, AiDelete, AiNew } from "./extensions/aiPreview";
import { FrontmatterNode } from "./extensions/frontmatter/FrontmatterNode";
import { Toc } from "./extensions/toc";
import { FormattingKeymap } from "./extensions/FormattingKeymap";
import { SourceMarkers } from "./extensions/sourceMarkers";
import { Mermaid } from "./extensions/mermaid";
import { Svg, SvgBlockParser } from "./extensions/svg";
import { Html, HtmlBlockParser } from "./extensions/htmlblock";
import { BlockHandle } from "./BlockHandle";
import { SelectionAIToolbar } from "./SelectionAIToolbar";
import { isProgrammaticUpdate, registerEditor, scheduleAutoSave } from "./editorController";
import { useAppStore } from "../state/appStore";
import "./editor.css";
import "./extensions/details/details.css";
import "./extensions/aiPreview/aiPreview.css";
import "./extensions/toc/toc.css";
import "./extensions/mermaid/mermaid.css";
import "./extensions/svg/svg.css";
import "./extensions/htmlblock/htmlblock.css";
import "./ai-toolbar.css";

const WELCOME_MARKDOWN = `---
title: Velora 之旅
---

# 欢迎使用 Velora

**AI-Native 工程文档编辑器** —— 所见即所得 · Mermaid/SVG 一等公民 · 多供应商 AI · 项目管理 · Git

这不是帮助文档,是一份**可以交互的旅程**:每个知识点下面都有真实实例,直接点击、编辑、体验。全部玩一遍,你就掌握 Velora 了。

[TOC]

## 第 1 站 · 所见即所得

你现在看到的没有任何 Markdown 符号——但它的真相是一棵文档树(AST),Markdown 只是保存时的文件格式。

试试点进下面这段文字,把光标放在"粗体"两个字中间——你会看到源码标记 \`**\` 原位浮现,移开又消失:

这段有 **粗体**、*斜体*、~~删除线~~ 和 \`行内代码\`,还有一个[链接](https://github.com/yetf1025-dev/velora)。

### 快捷键速记

| 操作 | 快捷键 |
| --- | --- |
| 标题 1-6 级 | ⌘1 ~ ⌘6 |
| 正文 | ⌘0 |
| 加粗 / 斜体 / 删除线 | ⌘B / ⌘I / ⇧⌘S |
| 代码块 | ⌘⌥C |
| 引用 / 列表 | ⌘⌥Q / ⌘⌥U·O·T |
| 插入 Mermaid | ⌘⌥M |

### 任务列表

- [x] 打开 Velora
- [ ] 试着勾选这一项(直接点方框)
- [ ] 用 ⇧⌘F 全局搜索这个文档

## 第 2 站 · Mermaid 一等公民

Mermaid 图不是"贴在文档里的代码块",而是文档节点。点击下面的图试试:

- **选中图** → 右侧 Inspector 出现主题面板,切换 6 套主题
- **右上角铅笔** → 编辑源码,失焦即重渲染
- **右键** → 转为 SVG(进画布微调)、导出、AI 优化

\`\`\`mermaid
graph LR
    A[Markdown] --> B[Document AST]
    B --> C[WYSIWYG]
    B --> D[Export]
    B --> E[AI]
\`\`\`

时序图也支持(注意时序图建议直接用 Mermaid 编辑,不进画布):

\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant V as Velora
    participant A as AI
    U->>V: 选中文字,点"优化"
    V->>A: 发送上下文
    A-->>V: 返回修改建议
    V-->>U: 就地预览,一键应用
\`\`\`

### AI 改图

选中上面的图,在 Inspector 里点「美化布局」或输入自定义指令(如"把方向改成 TB")——修改会以**红删绿增的 diff 预览**呈现,应用或拒绝由你决定。

## 第 3 站 · SVG 一等公民

SVG 同样是文档节点。下面的图:

- **单击** → 放大查看(滚轮缩放,Esc 退出)
- **双击** → 编辑源码
- **右键 → 画布编辑** → 拖拽元素、磁吸连线、对齐分布

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 120" role="img" aria-label="数据流示例">
  <rect x="10" y="35" width="90" height="44" rx="6" fill="#eef2ff" stroke="#6366f1"/>
  <text x="55" y="61" font-size="13" text-anchor="middle" fill="#1e1b4b">Markdown</text>
  <line x1="104" y1="57" x2="146" y2="57" stroke="#6366f1" stroke-width="2"/>
  <polygon points="146,53 154,57 146,61" fill="#6366f1"/>
  <rect x="156" y="35" width="90" height="44" rx="6" fill="#fff7ed" stroke="#d97706"/>
  <text x="201" y="61" font-size="13" text-anchor="middle" fill="#7c2d12">AST</text>
  <line x1="250" y1="57" x2="292" y2="57" stroke="#16a34a" stroke-width="2"/>
  <polygon points="292,53 300,57 292,61" fill="#16a34a"/>
  <rect x="302" y="35" width="34" height="44" rx="6" fill="#f0fdf4" stroke="#16a34a"/>
  <text x="319" y="61" font-size="12" text-anchor="middle" fill="#14532d">图</text>
</svg>

## 第 4 站 · AI 能力

AI 有三个入口,配好 Key 全部可用(设置 ⌘, → AI):

### 选中文字 → 浮动工具栏

选中这句话,工具栏第一行是格式操作(加粗/斜体/删除线…),第二行是 AI(优化/翻译/总结/扩写/自定义指令)。

### ⌘L → 对话

AI 始终能看到你当前编辑的文档。试着说"扩写第 1 站"——修改建议会**自动出现在对应章节的位置**,红删绿增,应用/拒绝一键决定。不满意继续说,AI 会基于原文+上一轮建议迭代。

### 渲染失败 → AI 修复

Mermaid 图如果语法错误(比如 AI 生成了非法箭头),错误条旁有「AI 修复」按钮,报错和源码自动发给 AI 修正。

### 多供应商

设置里内置 Anthropic / DeepSeek / GLM Coding Plan / Kimi + 自定义端点,每家独立记忆 Key 和模型。

## 第 5 站 · 项目与 Git

- **⌘B 左栏**:文件树 / 大纲 / Git 变更 / 检查(失效链接扫描)
- **打开文件夹**后:文件外部修改实时重载(Typora 式以磁盘为准)
- **Git**:变更列表、点文件看 diff、提交历史、⌘Enter 提交
- **⇧⌘F**:全项目全文搜索,高亮跳转

## 第 6 站 · 数据安全

- **原子保存**:写临时文件再 rename,崩溃不会写坏文件
- **自动保存**(可配置间隔):已存盘文档停顿后自动落盘
- **崩溃恢复**:未保存内容存草稿,重启提示恢复

## 第 7 站 · 导出

- **⌘P**:打印/导出 PDF(选纸张与方向,浏览器打印对话框存 PDF,与编辑器视觉一致)
- **命令面板 ⌘K**:导出 HTML(Mermaid/SVG 内联渲染)

<details>
<summary>折叠块:这里还能放任何内容</summary>

折叠块内部是完整的 Markdown 区域——包括 Mermaid 图、SVG、表格、代码块。

\`\`\`ts
// 代码块带语言标记,导出时保留
interface Velora {
  kernel: "ProseMirror";
  format: "Markdown";
}
\`\`\`

数学也行:行内 $E = mc^2$,块级:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

</details>

## 继续

- 源码模式:**⌘/** 随时切换,所见即所得与源码双向同步
- 更多:右键菜单、块手柄(悬停行左侧)、⌘D 日志
- 项目主页:[yetf1025-dev/velora](https://github.com/yetf1025-dev/velora)

> 现在就试试:选中这段话,按 ⌘L 问 AI"把这段话改得更有感染力"。
`;

export function VeloraEditor() {
  const setDirty = useAppStore((s) => s.setDirty);
  const setInspectorContext = useAppStore((s) => s.setInspectorContext);
  const columnRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Markdown,
      FrontmatterNode,
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      // renderWrapper:true 给每个表包一层 div.tableWrapper(DOM 层,schema
      // 与 Markdown 序列化不受影响);配合 CSS 让超宽表格在列内横向滚动,
      // 而不是撑破或被外层裁切
      TableKit.configure({ table: { renderWrapper: true } }),
      Mermaid,
      Details,
      AiPreview,
      AiDelete,
      AiNew,
      Toc,
      Svg,
      SvgBlockParser,
      Html,
      HtmlBlockParser,
      Mathematics,
      FormattingKeymap,
      SourceMarkers,
    ],
    content: WELCOME_MARKDOWN,
    contentType: "markdown",
    editorProps: {
      attributes: { class: "velora-editor" },
    },
    onUpdate: ({ editor }) => {
      // 文档变更后,若 InspectorContext 的 pos 越界则清掉(防止组件用旧 pos 访问新文档)
      const ctx = useAppStore.getState().inspectorContext;
      if (ctx && ctx.pos > editor.state.doc.content.size) {
        useAppStore.getState().setInspectorContext(null);
      }
      // 程序化 setContent(打开/切换文件)不标脏、不触发自动保存
      if (isProgrammaticUpdate()) return;
      setDirty(true);
      scheduleAutoSave();
    },
    onSelectionUpdate: ({ editor }) => {
      const { selection } = editor.state;
      // 选中块级节点 → 该节点;文本光标 → 光标所在的顶层块
      // Inspector 的源码面板对两者都生效(点击某行即可看到该行的 Markdown 源码)
      if (selection instanceof NodeSelection && selection.node.isBlock) {
        setInspectorContext({
          kind: selection.node.type.name,
          pos: selection.from,
        });
      } else {
        // 文本光标:取光标所在的最内层 textblock(列表项内则显示该行的源码)
        const $from = selection.$from;
        if ($from.depth >= 1) {
          try {
            const pos = $from.before($from.depth);
            setInspectorContext({ kind: $from.parent.type.name, pos });
          } catch {
            setInspectorContext(null);
          }
        } else {
          setInspectorContext(null);
        }
      }
    },
  });

  useEffect(() => {
    registerEditor(editor);
    return () => registerEditor(null);
  }, [editor]);

  return (
    // min-w-0:flex 链路上任一层缺它,内容都会把面板撑破(横向溢出)
    <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden">
      <div
        ref={columnRef}
        className="relative mx-auto w-full py-12"
        style={{
          // 上限 = 用户设置 + 两侧 padding;min(100%) 保证两侧面板拖宽、
          // 窗口缩小、滚动条挤占时列宽自动收缩,不产生横向溢出
          maxWidth: "min(calc(var(--vl-editor-width) + var(--vl-editor-padding) * 2), 100%)",
          paddingLeft: "var(--vl-editor-padding)",
          paddingRight: "var(--vl-editor-padding)",
        }}
      >
        <EditorContent editor={editor} />
        {editor && <SelectionAIToolbar editor={editor} />}
        {editor && <BlockHandle editor={editor} containerRef={columnRef} />}
      </div>
    </div>
  );
}
