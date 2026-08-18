# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

Velora 是 AI-Native 工程文档编辑器(Tauri 2 + React + TypeScript),不是 Markdown 渲染器。核心架构原则(详见 `docs/adr/`):

- **Markdown 是文件格式,不是内部数据模型** —— 内部真相是 ProseMirror Document AST(ADR-001)
- **三条边界**(ADR-003):React ≠ 文档模型 / Tiptap ≠ Markdown / Tauri ≠ 业务逻辑

## 常用命令

```bash
pnpm install
pnpm tauri dev          # macOS 桌面窗口(WKWebView);Rust 改动需重启
pnpm dev                # 仅前端,浏览器调试(Tauri 命令在此模式不可用)
pnpm build              # tsc 类型检查 + vite build
pnpm test               # vitest 单测
npx vitest run tests/unit/shapeIntersection.test.ts   # 跑单个测试文件

# e2e(Playwright WebKit,需先 pnpm dev 起 :1420)
node tests/e2e/canvas-d2.mjs

# Rust 侧单独编译检查
cargo check --manifest-path src-tauri/Cargo.toml
```

Tauri 命令在 `pnpm dev`(浏览器)下不可用;AI/文件/Git 等能力要 `pnpm tauri dev`。e2e 用真实鼠标点击(`page.mouse.*`)最可靠,`dispatchEvent("click")` 无坐标会留脏拖拽状态。

## 架构(按数据流分层)

```
src-tauri/   Rust 系统能力:fs/git/fs-watch(notify)/HTTP 代理(reqwest)
src/platform/  薄适配层:Tauri 命令包装(fileService/projectService/fileWatcher/nativeMenu)
src/editor/    Tiptap 装配 + 自定义节点 + NodeView + 排版主题
src/editor/extensions/  自定义节点(每个含 Node + NodeView + index + .css)
src/diagram/   Mermaid 引擎 + 6 套主题
src/ai/        AI Service Layer(多供应商)+ 对话
src/inspector/ 上下文 Inspector(光标所在块的源码/属性面板)
src/state/     zustand stores(app/git)
src/settings/  偏好 + 快捷键(可自定义,localStorage 持久化)
```

**自定义节点的 Markdown 映射是关键难点** —— 见下方"已验证的实现模式"。

## 已验证的实现模式(踩过坑,务必遵守)

这些规则来自真实 bug,违反会反复踩坑:

- **自定义节点的 `markdownTokenName` 必须是独立 token 名**(配合自定义 block tokenizer 产出该 token)。绝不能复用通用 token(如 `"paragraph"`)去"认领"——`@tiptap/markdown` 序列化先查 token 注册表,TocNode 曾因认领 `paragraph` 导致所有段落被序列化成 `[TOC]`。svgBlock/details/toc 均用独立 token 名。

- **NodeView 点击选中用三段式**:`onMouseDownCapture` + `preventDefault` + `requestAnimationFrame` 重断言。仅 `onClick` 不可靠(drag-handle 吞事件),仅捕获不够(PM mousedown 不响应 defaultPrevented)。但 **SVG 节点是例外**——见下条。

- **SVG NodeView 不用 capture/preventDefault**:那会吞掉 click/dblclick。SVG 的单/双击在 `.vl-svg-canvas` 的 `onMouseDown` 里**自己判**(300ms 内第二次 mousedown = 双击),选区也设在同一 handler。外层 `NodeViewWrapper` 不放 `data-drag-handle`(会吞子元素交互),拖拽由 `.vl-svg-drag-strip` 承担。

- **Tiptap NodeView 折叠块**:`NodeViewContent` 不能条件卸载(折叠时 PM 找不到挂载点会把子节点渲染到错误位置)。必须始终挂载 + CSS `display:none` 隐藏。

- **Radix Dialog 内容异步挂载**:`open` 翻转的 commit 里 portal 内容还没挂上,`ref.current` 是 null。用 callback ref + state(`useState<HTMLDivElement|null>`)驱动挂载逻辑,不要用 `useRef` + effect。SvgCanvasEditor 空白画布 bug 的解法。

- **AI 请求走 Rust HTTP 代理**(`http_request` 命令,reqwest):第三方供应商(GLM/Kimi/DeepSeek)不开 CORS,WebView fetch 会被 `TypeError: Load failed`。浏览器 dev 模式才回退 fetch。端点拼接用 `joinEndpoint`(容忍 Base URL 多/少写 `/v1`)。

- **画布缩放用 width/height,不用 CSS transform**:CSS transform 让 SVG 进合成层,WebKit 拖拽时高频改属性会残影/不重绘。

- **文件监听 A 方案**:外部修改当前文档 → 立即重载以磁盘为准。自己写盘前调 `notifySelfWriteStart()` 吸收回声(1.2s 窗口),否则保存事件被当外部修改触发死循环。

## 画布编辑器(SvgCanvasEditor)关键约定

经 `/grilling` 定型,见 `memory/velora-project.md`:

- **D2 方案**:会话内磁吸(边界相交精确落点),存盘是干净静态 SVG,**不持久化连接关系**。重新打开画布连线变死几何,拖节点不跟随(已认账代价)。
- 范围:**架构图/流程图**才进画布,**时序图留 Mermaid**。
- 五样图形:矩形/椭圆/菱形(`data-vl-shape="diamond"`) /文字/箭头。
- 边界相交:`src/editor/extensions/svg/shapeIntersection.ts`(线段∩{矩形,椭圆,菱形}),有单测。
- 会话内锚定:polyline 挂 `__vlStart/__vlEnd/__vlStartSide` 元素引用,`serializeNow` 剥离 `data-vl-anchor`。

## AI 供应商

`src/ai/providers.ts` 加一条记录即新增供应商。每家独立记忆 Key/模型/Base URL。GLM Coding Plan 用 Anthropic 兼容端点 `https://open.bigmodel.cn/api/anthropic`。协议分两类:anthropic(`/v1/messages`)/ openai(`/chat/completions`)。

## Rust 侧命令(`src-tauri/src/lib.rs`)

只做系统能力,不含文档业务:read_file / write_file / read_dir_tree / git_status / git_commit_all / git_diff / watch_dir / unwatch_dir(notify crate)/ http_request(reqwest)。新增命令要注册到 `invoke_handler!` 并在 `src-tauri/capabilities/default.json` 加权限。

## 全局约定

- 语言:所有对话和文档用中文(CLAUDE.md 除外,此文件给 Claude 读)。
- 文档 markdown;路径/链接末尾不要紧跟标点(会断链)。
- `cargo` 走 USTC 镜像;`tauri-plugin-fs-watch` 在该镜像找不到,文件监听用 `notify` crate 直接实现。
