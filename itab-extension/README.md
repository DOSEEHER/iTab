# iTab — Chrome 新标签页扩展程序

基于 **Chrome Extension Manifest V3** 规范开发的极简零权限扩展程序（参考 [Chrome 官方页面覆盖文档](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages)）。安装后，每次在 Chrome 打开新标签页（`Ctrl + T` / `Cmd + T` 或点击 `+` 号）时，将立即自动跳转至 `https://itab.xike.io`。

## 设计特点

- **固定目标地址**：硬编码跳转至 `https://itab.xike.io`，无多余弹窗或设置项。
- **最优跳转实现**：在 `<head>` 中结合 `<link rel="preconnect">` 预连接与同步 `window.location.replace("https://itab.xike.io")`，0 毫秒立即触发跳转且不污染标签页后退历史，同时内置浅色/深色主题背景防闪烁与 `<meta http-equiv="refresh">` 兜底。
- **零权限声明**：仅使用 `chrome_url_overrides.newtab` 原生机制，不申请任何浏览器隐私或标签页权限。
- **矢量高清图标**：使用 Lucide `square-bookmark`（`#2b79de`）精确渲染 16×16、32×32、48×48、128×128 透明背景图标。

## 安装方法

1. 将 `itab-extension.zip` 解压到本地任意固定目录（解压后得到 `itab-extension` 文件夹，安装后请勿删除）。
2. 在 Chrome 地址栏访问 `chrome://extensions/`，开启右上角 **「开发者模式」**。
3. 点击左上角 **「加载已解压的扩展程序」**，选择解压后的 `itab-extension` 文件夹（如果您之前已加载旧版，直接移除旧版后重新加载该文件夹即可）。
4. 按 `Ctrl + T` / `Cmd + T` 新建标签页测试；若首次打开新标签页时 Chrome 弹出「要改回 Google 吗？」提示，点击 **「保留」** 即可。

## 目录结构

| 文件路径 | 说明 |
| :--- | :--- |
| `manifest.json` | Manifest V3 清单文件（名称 `iTab`，零权限声明） |
| `newtab.html` | 新标签页覆盖入口，含域名预连接与防闪烁样式引用 |
| `newtab.js` | 硬编码 `window.location.replace("https://itab.xike.io")` 极速重定向脚本 |
| `newtab.css` | 跟随系统浅色/深色模式的零白屏过渡背景 |
| `icons/` | 基于 Lucide `square-bookmark` 渲染的 16/32/48/128 PNG 图标与原始 SVG |
