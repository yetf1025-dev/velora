# ADR-002:编辑内核选型 —— ProseMirror + Tiptap + Remark

- 状态:已接受
- 日期:2026-08-11

## 背景

候选内核:ProseMirror / Tiptap / Milkdown / Lexical / BlockNote / CodeMirror 6 Live Preview / 自研 ContentEditable。

## 决策

- **ProseMirror 是真正的编辑内核**(Schema / State / Transaction)
- **Tiptap 3.x 作为工程加速层**(Extension / Command / React 集成),但 Velora 不被其抽象绑死——文档模型与自定义节点由 Velora 自己定义
- **Remark/Unified 负责 Markdown 解析与序列化**;Tiptap 官方 Markdown 扩展(3.7+,`@tiptap/markdown`)作为参考实现,若对自定义节点支持不足,回退到自写 mdast ↔ PM 映射

## 否决项及理由

- **Milkdown 作为核心抽象**:适合「更好看的 Markdown WYSIWYG」,但 Velora 的文档模型超出其框架假设
- **CodeMirror 6 Live Preview**:是增强源码编辑器,不是真 WYSIWYG
- **Lexical**:Markdown 非其核心,需从头补
- **BlockNote**:Notion 式 Block 哲学,与「Markdown 文件 + 源码可控」方向不符
- **自研内核**:3-6 个月才到可用状态,MVP 阶段不可接受

## 桌面与前端栈(同批决策)

- 桌面壳:**Tauri 2**(macOS 先行,WKWebView;不用 Electron)
- UI:**React + TypeScript + Vite**
- UI 组件:**Radix UI primitives + 自建 Design System**(不套 Element Plus 等成品库)
- 样式:**Tailwind CSS + CSS Variables Design Token**
- 状态:**Zustand**
- 图表:**Mermaid + Velora 主题注册表**
