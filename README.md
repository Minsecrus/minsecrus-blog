# Minsecrus Blog

一个以全屏画布为永久页面、以 Markdown 为内容源的空间化博客框架。

首页 Markdown 是全站唯一根节点。正文中的标记会从词语本身引出连线，在画布中展开新的 Markdown 节点并更新 URL。再次点击会收起整条子树，URL 回到标记所在节点。所有内容仍然可以静态预渲染。

## 本地运行

```bash
pnpm install
pnpm dev
```

完整检查：

```bash
pnpm check
```

静态产物位于 `build/client`，可用下面的命令预览：

```bash
pnpm preview
```

## 部署

推送到 `main` 后，GitHub Actions 会检查项目并把 `build/client` 部署到：

<https://minsecrus.github.io/minsecrus-blog/>

Pages 构建使用 `/minsecrus-blog/` 作为应用与静态资源基路径；本地开发仍使用 `/`。
工作流会把预渲染页面与 SPA 的 `404.html` 回退整理到 `build/pages` 后发布。

## 写作方式

所有内容都放在 `content/` 中。`content/home.md` 按约定自动成为唯一根节点，不需要 frontmatter：

```md
# Minsecrus

我从[源码阅读](concept:source-reading)开始理解复杂软件。
```

展开一个概念子块：

```md
[源码阅读](concept:source-reading)
```

展开一篇文章子块：

```md
[自顶向下阅读 Kilo](article:kilo)
```

两种标记在画布上的行为一致：`+` 展开并进入子块路由，`−` 收起并返回父块路由。`article:` 会生成可直接访问的路径链接，`concept:` 用于正文中的概念标记。直接打开任意节点 URL 时，画布会从根节点逐层展开到该节点。

同一父块的子块永远向右展开，并严格按照这些标记在父块 Markdown 中出现的顺序从上到下排列，与点击顺序无关。展开后的镜头保持当前缩放比例，只平移到右侧的子块标题。

普通 Markdown 链接不受影响。其他节点的 ID 默认使用文件名，也可以在 frontmatter 中明确声明。标题默认取第一个 Markdown 标题。

## 核心结构

```text
content/*.md
    ↓ tools/content-graph.server.ts
单根内容图 + 行内锚点 + 可达路径
    ↓ virtual:minsecrus-content
永久 CanvasExperience
├─ Markdown DOM 节点
├─ SVG 连线
├─ 响应式布局
└─ 动画化镜头
```

- `tools/content-graph.server.ts`：编译 Markdown，检查唯一根、断链、循环和不可达节点。
- `app/canvas/CanvasExperience.tsx`：维护展开实例、镜头、深链接和动画状态。
- `app/canvas/MarkdownNode.tsx`：渲染可选择、可复制的真实 DOM 内容。
- `app/canvas/treeLayout.ts`：按照父块原文顺序计算可见认知树布局。
- `app/canvas/geometry.ts`：纯函数连线与镜头计算。

内容图与画布运行时相互独立，未来可以替换布局算法或编辑器，而不改变 Markdown 文件。

## License

[MIT](./LICENSE) © 2026 Minsecrus
