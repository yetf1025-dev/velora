# ADR-004:AI 修改 Document Model,不直接改文本

- 状态:已接受
- 日期:2026-08-12

## 背景

Velora 的 AI 能力(选中文字优化、Mermaid/SVG 改图、对话)初期是"AI 返回结果文本 → 用户自己粘贴/替换"。建议阶段提出:AI 应升级为编辑器能力,直接作用在 Document Model 上,且所有修改可预览、可撤销。

## 决策

1. **AI 修改走 Document Transaction,不直接替换 Markdown 字符串**
   - 改 Mermaid/SVG:`tr.setNodeMarkup(pos, undefined, { ...attrs, source/theme: next })` —— 改节点属性,经 PM undo 栈
   - 改正文文字:`insertContentAt({from,to}, ...)` 经 markdown 解析为节点
   - 不做"AI 返回整篇 Markdown → 替换全文"这种粗暴方式

2. **所有 AI 修改可预览、可撤销**
   - 结构化修改(节点属性/插入/删除):进 PM transaction 栈,⌘Z 即可撤销
   - 高风险修改(整段重写、多处变动):先 Diff 预览面板,用户 Accept 才落库;Reject 则丢弃

3. **AI 产出的是操作意图,不是最终文本**
   - Mermaid 改图:AI 返回新 mermaid 源码 → 作为 `source` 属性写回 mermaid 节点
   - SVG 改图:AI 返回新 SVG → 写回 svgBlock 节点的 `source` 属性
   - 文档级 Agent(后续):AI 返回结构化操作(替换节点/插入节点)而非整篇 Markdown

## 推论

- AI 不持有"文档真相"——真相永远在 PM Document
- 任何 AI 改动都必须能在不依赖 AI 的情况下撤销(PM undo)
- 对话面板(⌘L)的纯问答可以返回文本供用户参考,不算文档修改

## 边界(本轮不做)

- AI Agent 跨节点批处理(如"改全文所有图方向"):需操作意图协议,后续
- Diff 预览的粒度:本轮做单节点属性级(Mermaid 源码/SVG 源码的前后对比),跨节点 Diff 后续
