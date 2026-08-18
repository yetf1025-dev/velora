# ADR-003:三条边界

- 状态:已接受
- 日期:2026-08-11

## 决策

```
React Application          Rust/Tauri
(用户看到什么、怎么操作)     (桌面系统能做什么)
       │                        │
   Editor  UI  AI           FS  Git  Export
       │
     Tiptap
       │
  ProseMirror                (文档是什么)
       │
Velora Document Model
```

1. **React ≠ 文档模型** —— React 只负责渲染与交互,文档真相在 ProseMirror Document
2. **Tiptap ≠ Markdown** —— Markdown 进出都经过 remark 层,Tiptap 不持有文件格式语义
3. **Tauri ≠ 业务逻辑** —— Rust 侧只做 FS/Git/Export 等系统能力,不含文档业务规则

## 执行方式

MVP 阶段单 package,用 ESLint `import/no-restricted-paths` 强制依赖方向:

- `document/` `markdown/` 不依赖 `editor/`
- `editor/` 不依赖 React UI 组件
- `src/`(前端)不反向依赖 Tauri 命令细节,经 `src/platform/` 薄适配层调用

当出现第二个消费者(CLI / 服务端渲染 / AI 批量处理)时,再把 `document/` + `markdown/` 抽为独立 package。
