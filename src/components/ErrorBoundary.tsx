import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * 顶层错误边界:渲染崩溃时显示提示(而非白屏),提供重载按钮。
 * dev 热更新后 store 形状变化等导致的崩溃走这里。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    void import("../platform/logService").then(({ logError }) =>
      logError(error, "渲染崩溃(ErrorBoundary)"),
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 32,
            fontFamily: "var(--vl-font-ui)",
            color: "var(--vl-text)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600 }}>界面渲染出错</div>
          <pre
            style={{
              maxWidth: 560,
              maxHeight: 200,
              overflow: "auto",
              padding: 12,
              borderRadius: 8,
              background: "var(--vl-code-bg)",
              color: "var(--vl-danger)",
              fontSize: 12,
              fontFamily: "var(--vl-font-mono)",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "none",
              background: "var(--vl-accent)",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            重新加载
          </button>
          <span style={{ fontSize: 11, color: "var(--vl-text-faint)" }}>
            错误已记录到日志(⌘D 查看,重载后)
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
