/**
 * Velora 基础扩展集(无 NodeView 版本)
 * 供测试与导出等非 React 场景使用;VeloraEditor 使用带 NodeView 的 Mermaid/Svg。
 */
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Mathematics } from "@tiptap/extension-mathematics";
import { DetailsNode } from "./details/DetailsNode";
import { FrontmatterNode } from "./frontmatter/FrontmatterNode";
import { MermaidNode } from "./mermaid/MermaidNode";
import { TocNode } from "./toc/TocNode";
import { SvgBlockParser, SvgNode } from "./svg/SvgNode";

export function veloraBaseExtensions() {
  return [
    FrontmatterNode,
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    Markdown,
    Image,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit,
    MermaidNode,
    DetailsNode,
    TocNode,
    SvgNode,
    SvgBlockParser,
    Mathematics,
  ];
}
