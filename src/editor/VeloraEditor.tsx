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
import "./ai-toolbar.css";

const WELCOME_MARKDOWN = `# 欢迎使用 Velora

AI-Native Engineering Document Editor。

- **所见即所得** —— 你现在看不到任何 Markdown 符号
- \`Cmd+O\` 打开一个 Markdown 文件试试
- \`Cmd+S\` 保存,序列化回 Markdown

> Markdown 只是文件格式,文档 AST 才是核心。

## Mermaid 是一等公民

\`\`\`mermaid
graph LR
    A[Markdown] --> B[Document AST]
    B --> C[WYSIWYG]
    B --> D[Export]
\`\`\`

<details>
<summary>支持的折叠块</summary>

折叠块内部是完整的 Markdown 区域,可以放 **任何节点**——包括 Mermaid 图、SVG、表格和代码块。

</details>

## SVG 是一等公民

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="示例图">
  <rect x="10" y="30" width="90" height="40" rx="6" fill="#eef2ff" stroke="#6366f1"/>
  <text x="55" y="55" font-size="13" text-anchor="middle" fill="#1e1b4b">输入</text>
  <line x1="104" y1="50" x2="150" y2="50" stroke="#6366f1" stroke-width="2"/>
  <rect x="154" y="30" width="90" height="40" rx="6" fill="#f0fdf4" stroke="#16a34a"/>
  <text x="199" y="55" font-size="13" text-anchor="middle" fill="#14532d">输出</text>
</svg>
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
      TableKit,
      Mermaid,
      Details,
      AiPreview,
      AiDelete,
      AiNew,
      Toc,
      Svg,
      SvgBlockParser,
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
    <div className="h-full overflow-y-auto">
      <div
        ref={columnRef}
        className="relative mx-auto w-full py-12"
        style={{
          maxWidth: "calc(var(--vl-editor-width) + var(--vl-editor-padding) * 2)",
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
