/**
 * SourceMarkers —— Typora 式原位源码标记。
 *
 * 光标进入带格式的内容时,在原位置显示 Markdown 标记:
 *   粗体/斜体/删除线/行内代码 → 范围两端显示 **  *  ~~  `
 *   链接 → [文字](url)
 *   标题 → 行首显示 # ## ### …
 * 光标移走后恢复纯渲染效果。
 *
 * 实现:ProseMirror Decoration(widget + node 装饰),标记不可编辑、不参与文档内容。
 */
import { Extension, getMarkRange } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Mark } from "@tiptap/pm/model";

/** 开闭相同的行内标记 */
const INLINE_MARKERS: Record<string, string> = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
};

function markerSpan(text: string): () => HTMLElement {
  return () => {
    const span = document.createElement("span");
    span.className = "vl-md-marker";
    span.textContent = text;
    span.contentEditable = "false";
    return span;
  };
}

function markDecorations($from: Parameters<typeof getMarkRange>[0], mark: Mark): Decoration[] {
  const range = getMarkRange($from, mark.type, mark.attrs);
  if (!range) return [];

  const name = mark.type.name;
  if (name === "link") {
    const href = (mark.attrs.href as string) ?? "";
    return [
      Decoration.widget(range.from, markerSpan("["), { side: -1, key: `md-a-${range.from}` }),
      Decoration.widget(range.to, markerSpan(`](${href})`), { side: 1, key: `md-b-${range.to}` }),
    ];
  }
  const marker = INLINE_MARKERS[name];
  if (!marker) return [];
  return [
    Decoration.widget(range.from, markerSpan(marker), { side: -1, key: `md-a-${range.from}-${name}` }),
    Decoration.widget(range.to, markerSpan(marker), { side: 1, key: `md-b-${range.to}-${name}` }),
  ];
}

export const SourceMarkers = Extension.create({
  name: "sourceMarkers",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("sourceMarkers"),
        props: {
          decorations(state) {
            const { selection, doc } = state;
            if (selection instanceof NodeSelection) return null;

            const decos: Decoration[] = [];
            const { $from } = selection;

            // 行内 mark:光标处的 bold/italic/strike/code/link
            for (const mark of $from.marks()) {
              decos.push(...markDecorations($from, mark));
            }

            // 块级标记:标题行首显示 #
            const parent = $from.parent;
            if (parent.type.name === "heading" && $from.depth >= 1) {
              const pos = $from.before($from.depth);
              decos.push(
                Decoration.node(pos, pos + parent.nodeSize, {
                  "data-mdmarker": "#".repeat(parent.attrs.level as number) + " ",
                  class: "vl-md-srcblock",
                }),
              );
            }

            return decos.length ? DecorationSet.create(doc, decos) : null;
          },
        },
      }),
    ];
  },
});
