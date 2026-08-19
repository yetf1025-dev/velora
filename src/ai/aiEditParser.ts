/**
 * AI edit 块解析:从回复里提取 ```edit 代码块 + 定位注释。
 *
 * 格式:
 *   ```edit
 *   <!-- after-heading: 章节标题 -->
 *   要写入的 markdown 内容
 *   ```
 */

export interface AiEdit {
  content: string;
  afterHeading?: string;
  replaceHeading?: string;
  atEnd: boolean;
}

const EDIT_RE = /```edit([^\n]*)\n([\s\S]*?)```/g;
const LOCATE_RE = /<!--\s*(after-heading|replace-heading|at-end)\s*:?\s*([^>]*?)-->/;

export function extractEdits(reply: string): AiEdit[] {
  const edits: AiEdit[] = [];
  let m: RegExpExecArray | null;
  EDIT_RE.lastIndex = 0;
  while ((m = EDIT_RE.exec(reply)) !== null) {
    // 首行尾巴(```edit 同行的内容,常是挤在同一行的定位注释)+ 主体
    let body = m[1] + "\n" + m[2];
    let afterHeading: string | undefined;
    let replaceHeading: string | undefined;
    let atEnd = false;
    const loc = body.match(LOCATE_RE);
    if (loc) {
      if (loc[1] === "after-heading") afterHeading = loc[2].trim();
      if (loc[1] === "replace-heading") replaceHeading = loc[2].trim();
      if (loc[1] === "at-end") atEnd = true;
      body = body.replace(LOCATE_RE, "");
    }
    body = body.trim();
    if (body) {
      edits.push({ content: body, afterHeading, replaceHeading, atEnd });
    }
  }
  return edits;
}
