import { useEffect, useState } from "react";
import { getEditor } from "../editor/editorController";

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

/** 项目大纲:从当前文档标题生成,点击跳转 */
export function Outline() {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const editor = getEditor();

  useEffect(() => {
    if (!editor) return;
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
    if (!editor) return;
    editor.commands.setTextSelection(pos + 1);
    editor.commands.focus();
    (editor.view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (headings.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-4 text-center text-xs"
        style={{ color: "var(--vl-text-faint)" }}
      >
        当前文档没有标题
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {headings.map((h, i) => (
        <button
          key={`${h.pos}-${i}`}
          type="button"
          className="w-full truncate py-[3px] pr-2 text-left text-[13px] transition-colors hover:bg-[var(--vl-panel-active)]"
          style={{
            paddingLeft: `${(h.level - 1) * 12 + 10}px`,
            color: h.level === 1 ? "var(--vl-text)" : "var(--vl-text-muted)",
            fontWeight: h.level <= 2 ? 600 : 400,
          }}
          onClick={() => jumpTo(h.pos)}
          title={h.text}
        >
          {h.text || "(空标题)"}
        </button>
      ))}
    </div>
  );
}
