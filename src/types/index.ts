export interface Category {
  id: number
  name: string
  icon: string
  sort_order: number
  is_public: number // 0 or 1
  share_slug: string | null
  share_description: string
  ai_prompt?: string
  created_at?: string
  updated_at?: string
}

export interface Bookmark {
  id: number
  category_id: number
  title: string
  url: string
  remark: string
  custom_icon_url: string
  sort_order: number
  ai_prompt?: string
  created_at?: string
  updated_at?: string
}

export interface BootstrapData {
  categories: Category[]
  bookmarks: Bookmark[]
  global_agent_prompt?: string
  mcp_token?: string
}

export interface PublicShareData {
  category: Category
  bookmarks: Bookmark[]
}

export interface AuthState {
  token: string | null
  expiresAt: number | null
  mode: 'persistent' | 'temporary' | null
  isAuthenticated: boolean
}

export interface ScrapedMeta {
  title: string
  description: string
  favicon: string
}

export interface BackupPayload {
  version: string
  exported_at: string
  global_agent_prompt?: string
  categories: Category[]
  bookmarks: Bookmark[]
}

