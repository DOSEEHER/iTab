-- Migration 0002: Add AI Agent 3-Tier Prompt Architecture & Native MCP Support
-- Author: Apple

-- 1. Add ai_prompt column to categories and bookmarks
ALTER TABLE categories ADD COLUMN ai_prompt TEXT DEFAULT '';
ALTER TABLE bookmarks ADD COLUMN ai_prompt TEXT DEFAULT '';

-- 2. Create site_config table for global settings & global AI prompt
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_config (key, value) VALUES (
  'global_agent_prompt',
  '这里是 iTab 个人专属网址与 AI 技能导航中心。请先读取分类列表与分类提示词以理解目录结构；在访问任何具体网址前，请务必遵循该网址卡片下绑定的专属 AI 提示词（Bookmark AI Prompt）执行操作。'
);
