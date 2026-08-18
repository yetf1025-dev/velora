---
title: 兼容性测试
tags: [a, b]
---

# Frontmatter

上方 YAML frontmatter(Obsidian 常见)。

# 嵌套列表

- 一级 A
  - 二级 A1
    - 三级 A1a
  - 二级 A2
- 一级 B

1. 有序一
   1. 嵌套有序
   2. 嵌套有序二
2. 有序二

# 任务列表混合

- [x] 完成
- [ ] 未完成
- 普通项
- [x] 又一个完成

# 表格(对齐)

| 左 | 中 | 右 |
|:---|:--:|---:|
| a | b | c |
| 长内容长内容 | d | e |

# 引用嵌套

> 一层
>> 二层
> 一层

# 脚注(GitHub/Typora)

正文有脚注[^1],还有长脚注[^long]。

[^1]: 第一个脚注。
[^long]: 长脚注内容,跨多词。

# 转义

星号 \* 不变斜体\* 反斜杠 `\\` 井号 \# 方括号 \[x\]。

# Unicode 与 Emoji

中文混合 English 数字 123。Emoji 🚀🎉 中文。全角符号【】《》。

# HTML 内联

<span style="color:red">红字</span> 与 <kbd>Ctrl</kbd> 键。

# 代码围栏(无语言/波浪号)

```
plain code
```

~~~rust
let x = 1;
~~~

# 分隔线与空行

---

# 链接形式

[行内](https://a.com)

[引用式][ref]

[ref]: https://b.com "标题"

<https://auto.link>

# 自动换行软断行

第一行  
第二行(两空格软断行)

第一行
第二行(CommonMark 软断行)
