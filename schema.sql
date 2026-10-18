DROP TABLE IF EXISTS bookmarks;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Folder',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 0,
  share_slug TEXT UNIQUE,
  share_description TEXT DEFAULT '',
  ai_prompt TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  remark TEXT DEFAULT '',
  custom_icon_url TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_prompt TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_sort ON categories(sort_order);
CREATE INDEX idx_categories_share_slug ON categories(share_slug) WHERE is_public = 1;
CREATE INDEX idx_bookmarks_category_sort ON bookmarks(category_id, sort_order);

-- System Defaults
INSERT OR IGNORE INTO site_config (key, value) VALUES (
  'global_agent_prompt',
  '这里是 iTab 个人专属网址与 AI 技能导航中心。请先读取分类列表与分类提示词以理解目录结构；在访问任何具体网址前，请务必遵循该网址卡片下绑定的专属 AI 提示词（Bookmark AI Prompt）执行操作。'
);

