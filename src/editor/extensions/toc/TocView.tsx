import { useEffect, useState } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

/**
 * TOC NodeView:实时从文档标题生成目录,点击跳转。
 * 不在 NodeView 内编辑(内容由文档驱动)。
 */
export function TocView({ editor, selected }: NodeViewProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  useEffect(() => {
    const collect = () => {
      const items: HeadingItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          items.push({
            level: node.attrs.level as number,
            text: node.textContent,
            pos,
          });
        }
      });
      setHeadings(items);
    };
    collect();
    editor.on("update", collect);
    return () => {
      editor.off("update", collect);
    };
  }, [editor]);

  const jumpTo = (pos: number) => {
    editor.commands.setTextSelection(pos + 1);
    editor.commands.focus();
    (editor.view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <NodeViewWrapper
      className="vl-toc"
      data-selected={selected || undefined}
      contentEditable={false}
    >
      <div className="vl-toc-title">目录</div>
      {headings.length === 0 ? (
        <div className="vl-toc-empty">文档还没有标题</div>
      ) : (
        headings.map((h, i) => (
          <button
            key={`${h.pos}-${i}`}
            type="button"
            className="vl-toc-item"
            style={{ paddingLeft: `${(h.level - 1) * 16 + 4}px` }}
            onClick={() => jumpTo(h.pos)}
          >
            {h.text || "(空标题)"}
          </button>
        ))
      )}
    </NodeViewWrapper>
  );
}
