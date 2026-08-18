/**
 * Source Mode:CodeMirror 6 源码视图。
 * 与视觉模式共享同一份文档:切入源码时序列化,切回视觉时重新解析。
 */
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { getSourceDraft, setSourceDraft } from "../editor/editorController";
import { useAppStore } from "../state/appStore";

export function SourceEditor() {
  const theme = useAppStore((s) => s.theme);

  return (
    <div className="vl-source h-full overflow-y-auto">
      <CodeMirror
        value={getSourceDraft()}
        onChange={(value) => setSourceDraft(value)}
        extensions={[markdown()]}
        theme={theme}
        basicSetup={{ lineNumbers: false, foldGutter: false }}
        style={{
          height: "100%",
          fontFamily: "var(--vl-font-mono)",
          fontSize: "13px",
        }}
      />
    </div>
  );
}
