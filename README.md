# Velora

**AI-Native Engineering Document Editor** —— 所见即所得 · 原生 SVG · 极致 Mermaid · Markdown 原生 · AI 原生(P1)

> Markdown 只是文件格式,Document AST 才是核心。详见 `docs/vision.md` 与 `docs/adr/`。

## 开发

```bash
pnpm install
pnpm tauri dev     # 桌面窗口(macOS, WKWebView)
pnpm dev           # 仅前端(浏览器调试)
pnpm test          # vitest: Markdown round-trip / 节点映射
pnpm build         # tsc + vite build
```

## 架构三条边界(ADR-003)

1. **React ≠ 文档模型** —— 文档真相在 ProseMirror Document
2. **Tiptap ≠ Markdown** —— Markdown 进出经过 remark/marked 层
3. **Tauri ≠ 业务逻辑** —— Rust 侧只做 FS/Git/Export 系统能力

## 目录

```
src/
├── design-system/   Design Token + Radix 封装
├── editor/          Tiptap 装配 + 自定义节点(mermaid/svg)+ 排版主题
├── diagram/         Diagram Engine + 6 套 Mermaid 主题
├── inspector/       上下文 Inspector(Mermaid 面板已实现)
├── export/          HTML 导出管线
├── platform/        Tauri 薄适配层(文件读写/对话框)
├── state/           zustand
└── components/      TopBar / StatusBar / SourceEditor
tests/
├── fixtures/        showcase.md(全元素样例)
└── roundtrip/       round-trip 幂等 + 语义保留测试
```

## MVP 状态

- [x] WYSIWYG(标题/粗体/表格/任务列表直接编辑,无 Markdown 符号)
- [x] Markdown round-trip(语义无损 + 风格归一,10 项测试)
- [x] Mermaid 一等公民(6 套 Velora 主题、Inspector、错误兜底、导出 SVG)
- [x] SVG 一级公民(文件引用 + 内联,双击编辑源码可写回 .svg 文件)
- [x] Code / Table / Image / Math(KaTeX)
- [x] 文件打开/保存(⌘O / ⌘S)+ HTML 导出
- [x] Source Mode(状态栏点击 Visual/Markdown 切换)

## 已知边界

- round-trip 追求语义无损而非字节一致(ADR-001)
- 表格序列化会对单元格补空格对齐(风格归一)
- PDF 导出属 P1(WKWebView 打印链路可行,待正式管线)
