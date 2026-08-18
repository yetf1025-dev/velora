# Velora 产品北极星

> **Velora —— AI-Native Engineering Document Editor**
> 所见即所得 · 原生 SVG · 极致 Mermaid · Markdown 原生 · AI 原生

本文档记录长期方向,不约束 MVP 执行范围(MVP 范围见计划与任务列表)。

## 定位

不是「另一个 Markdown 编辑器」,而是**工程师的下一代文档工作空间**:

```text
Markdown 是文件格式
        ↓
Document Model 是核心
        ↓
WYSIWYG 是主要交互方式
        ↓
SVG / Mermaid / Code / Math 是一级文档对象
        ↓
AI 是编辑能力的一部分
        ↓
最终输出 Markdown / HTML / PDF
```

## 与 Typora 的差异

| | Typora | Velora |
|---|---|---|
| Markdown | 核心 | 核心格式 |
| WYSIWYG | ✅ | **核心能力** |
| Mermaid | 支持 | **重点打造** |
| SVG | HTML 嵌入 | **一级节点** |
| 文档 AST | 偏渲染 | **核心模型** |
| AI | 基本无 | **原生 AI** |
| 项目级文档 | 弱 | **重点** |
| 文档检查 | 弱 | **工程化** |
| 插件 | 有限 | **Extension Architecture** |
| Git | 弱 | **工程级支持** |
| PDF | 基础 | **高质量导出(与编辑器视觉一致)** |

## 路线图

```text
Velora 0.1  Markdown + WYSIWYG
Velora 0.5  Mermaid + SVG + Visual Engine
Velora 1.0  AI-native Editing
Velora 2.0  Engineering Workspace(项目/文档检查/Git)
Velora 3.0  Knowledge + Collaboration + Agents
```

## Backlog 分层

- **P0(MVP)**:WYSIWYG / Markdown 兼容 / Mermaid / SVG / Code / Table / Image / Math / 文件打开保存 / HTML 导出 / Source Mode
- **P1**:AI、Outline、Command Palette、Project Explorer、Git、文档检查、Split Mode、PDF 导出管线
- **P2**:MCP、Skill、协作、知识库、Plugin Marketplace

## AI 设计原则(P1 时展开)

AI 不是侧边聊天框,而是 **Context AI**:

- 选中文字 → 优化 / 改写 / 翻译 / 扩写 / 总结
- 选中 Mermaid → 优化布局 / 美化 / 补充节点 / 转换类型(改 Mermaid source,不改 SVG)
- 选中代码 → Explain / Review / Optimize / Test
- 选中整个文档 → Review / Improve Structure / Find Contradictions / Generate TOC

## 文档工程能力(P2 方向)

- Broken Link 检查
- 文档一致性(正文 vs 架构图的数值/描述矛盾检测)
- 文档引用关系图
- Git 集成:Diff / History / Blame / Commit / Branch / AI Review Changes
