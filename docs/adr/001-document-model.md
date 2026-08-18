# ADR-001:Markdown 是文件格式,不是内部数据模型

- 状态:已接受
- 日期:2026-08-11

## 背景

Velora 的目标是超越 Typora 的 AI-Native 工程文档编辑器。Typora 式编辑器把 Markdown 字符串当作编辑对象,渲染链是 `Markdown → HTML → DOM`,导致 SVG/Mermaid 等内容被当作 HTML 标签处理,产生大量兼容性问题。

## 决策

- Velora 的内部真相是 **Document AST**(ProseMirror Document),Markdown 只是持久化格式之一
- Mermaid / SVG / Math / Code 是**一等公民 Document Node**,有专用渲染路径,不经 HTML 注入
- 渲染管线是 `Document AST → 多目标 Renderer`(Editor / Preview / Export),而非 `Markdown → HTML`

## 推论

- 任何功能不得把 Markdown 字符串当作编辑时数据结构
- 新内容类型必须先定义为 Schema 节点,再谈渲染
- Markdown 往返要求「语义无损 + 风格归一」,不追求字节级一致
