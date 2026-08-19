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

// 外层围栏:四反引号(推荐,内容可含 ``` 代码块)或三反引号(旧格式)
// ([`]{3,4}) 捕获开围栏长度,闭合必须是同长度围栏
const EDIT_RE = /(`{3,4})edit([^\n]*)\n([\s\S]*?)\1(?!`)/g;
const LOCATE_RE = /<!--\s*(after-heading|replace-heading|at-end)\s*:?\s*([^>]*?)-->/;

export function extractEdits(reply: string): AiEdit[] {
  const edits: AiEdit[] = [];
  let m: RegExpExecArray | null;
  EDIT_RE.lastIndex = 0;
  while ((m = EDIT_RE.exec(reply)) !== null) {
    // 首行尾巴(edit 同行的内容,常是挤在同一行的定位注释)+ 主体
    let body = m[2] + "\n" + m[3];
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
