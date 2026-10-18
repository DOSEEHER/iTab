-- Optional Demo / Seed Data for iTab
-- Run only if you want sample categories and bookmarks to explore features

INSERT INTO categories (id, name, icon, sort_order, is_public, share_slug, share_description, ai_prompt) VALUES
  (1, '日常常用', 'Sparkles', 0, 1, 'daily-tools', '个人精选的高频开发与生活效率工具集合', '这是高频工具库。在访问本分类下的站点时，优先利用快捷导航和已登录状态进行自动化工作。'),
  (2, '开发探索', 'Code2', 1, 0, NULL, '', '技术文档与框架集合。访问时着重提取 API 文档、技术栈更新和配置参考。'),
  (3, '设计灵感', 'Palette', 2, 0, NULL, '', 'UI/UX 和设计参考。访问时重点收集配色方案、组件布局以及动效交互设计。');

INSERT INTO bookmarks (category_id, title, url, remark, custom_icon_url, sort_order, ai_prompt) VALUES
  (1, 'GitHub', 'https://github.com', '全球最大的开源代码托管与协作平台', '', 0, '进入后优先检查 Notifications、Trending 榜单或特定 Repo 的 Issues 和 Pull Requests。'),
  (1, 'Cloudflare Dashboard', 'https://dash.cloudflare.com', '全球云网络平台与 Edge Workers/D1 控制台', '', 1, '检查 Workers 监控指标、D1 数据库配额和 DNS 解析状态。'),
  (1, 'Vue.js 官网', 'https://vuejs.org', '渐进式 JavaScript 框架，轻量且高性能', '', 2, '查阅 Composition API 与单文件组件最佳实践文档。'),
  (2, 'Hono Framework', 'https://hono.dev', '超轻量、极致迅速的 Edge Web 框架', '', 0, '聚焦 Cloudflare Workers / D1 中间件与路由绑定写法。'),
  (2, 'Tailwind CSS', 'https://tailwindcss.com', '现代实用优先的前端 CSS 框架', '', 1, '检索 v4 版本的 CSS-first 配置和实用类速查。'),
  (3, 'Linear', 'https://linear.app', '下一代项目管理工具与顶级 UI/UX 设计典范', '', 0, '分析其极简键盘驱动流与工单流转动效设计。'),
  (3, 'Raycast', 'https://raycast.com', '可扩展的极速启动器与效率工具', '', 1, '探索其插件生态与快捷键工作流方案。');
