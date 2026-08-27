/**
 * 编辑器正文列宽上限设置。
 * token 方案:设置值写回根元素上的 --vl-editor-width,
 * 消费方(VeloraEditor 列容器)用 min(token, 100%) 兜住实际可用宽度——
 * 两侧面板拖宽/窗口缩小/滚动条挤占时列宽自动收缩,不会横向溢出。
 */
import { useEffect } from "react";
import { usePrefsStore } from "./prefsStore";

/** 把编辑器宽度偏好同步到根元素 Design Token(应用挂载时调用一次) */
export function useEditorWidthToken(): void {
  const width = usePrefsStore((s) => s.editorMaxWidth);
  useEffect(() => {
    document.documentElement.style.setProperty("--vl-editor-width", `${width}px`);
  }, [width]);
}
