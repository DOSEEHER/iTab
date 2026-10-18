/**
 * Native Stateless Streamable HTTP MCP Server & AI Agent Integration
 * Implements JSON-RPC 2.0 over HTTP for Cloudflare Workers Free Tier
 * Author: Apple
 */

import type { Env } from './index'

export const DEFAULT_GLOBAL_AGENT_PROMPT =
  '这里是 iTab 个人专属网址与 AI 技能导航中心。请先读取分类列表与分类提示词以理解目录结构；在访问任何具体网址前，请务必遵循该网址卡片下绑定的专属 AI 提示词（Bookmark AI Prompt）执行操作。'

/**
 * Deterministically compute or retrieve the expected MCP access token.
 * If env.MCP_API_TOKEN is set, use it.
 * Otherwise derive using HMAC-SHA256(JWT_SECRET, "itab-mcp-v1").
 */
export async function getExpectedMcpToken(env: Env): Promise<string> {
  if (env.MCP_API_TOKEN && env.MCP_API_TOKEN.trim()) {
    return env.MCP_API_TOKEN.trim()
  }

  const secret = env.JWT_SECRET || 'itab_default_fallback_secret_key_32chars'
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode('itab-mcp-v1')

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `itab_${hex.slice(0, 32)}`
}

/**
 * Verify whether incoming request has valid MCP credentials via:
 * 1. Authorization: Bearer <token>
 * 2. Header: X-MCP-Token: <token>
 * 3. Query parameter: ?token=<token>
 */
export async function validateMcpAuth(req: Request, env: Env): Promise<boolean> {
  const expected = await getExpectedMcpToken(env)
  const url = new URL(req.url)

  // 1. Query param
  const queryToken = url.searchParams.get('token')
  if (queryToken && queryToken.trim() === expected) {
    return true
  }

  // 2. Header: X-MCP-Token
  const customHeader = req.headers.get('x-mcp-token')
  if (customHeader && customHeader.trim() === expected) {
    return true
  }

  // 3. Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim()
    if (bearerToken === expected) {
      return true
    }
  }

  return false
}

/**
 * Fetch the global agent prompt from site_config table or return default
 */
export async function getGlobalAgentPrompt(db: D1Database): Promise<string> {
  try {
    const row = await db
      .prepare('SELECT value FROM site_config WHERE key = ?')
      .bind('global_agent_prompt')
      .first<{ value: string }>()
    return row?.value || DEFAULT_GLOBAL_AGENT_PROMPT
  } catch {
    return DEFAULT_GLOBAL_AGENT_PROMPT
  }
}

/**
 * HTMLRewriter webpage metadata scraper for MCP auto-filling
 */
export async function scrapeWebMeta(
  rawUrl: string
): Promise<{ title: string; description: string; favicon: string }> {
  let url = rawUrl.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return { title: '', description: '', favicon: '' }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    clearTimeout(timeoutId)

    let title = ''
    let description = ''
    let icon = ''

    const rewriter = new HTMLRewriter()
      .on('title', {
        text(chunk) {
          title += chunk.text
        },
      })
      .on('meta[name="description"]', {
        element(element) {
          if (!description) {
            description = element.getAttribute('content') || ''
          }
        },
      })
      .on('meta[property="og:description"]', {
        element(element) {
          if (!description) {
            description = element.getAttribute('content') || ''
          }
        },
      })
      .on('link[rel~="icon"]', {
        element(element) {
          if (!icon) {
            icon = element.getAttribute('href') || ''
          }
        },
      })
      .on('link[rel="apple-touch-icon"]', {
        element(element) {
          if (!icon) {
            icon = element.getAttribute('href') || ''
          }
        },
      })

    const transformed = rewriter.transform(response)
    await transformed.text()

    title = title.trim() || parsedUrl.hostname
    description = description.trim()

    if (icon) {
      try {
        icon = new URL(icon, parsedUrl.href).href
      } catch {
        icon = ''
      }
    }
    if (!icon) {
      icon = `${parsedUrl.origin}/favicon.ico`
    }

    return { title, description, favicon: icon }
  } catch {
    return {
      title: parsedUrl.hostname,
      description: '',
      favicon: `${parsedUrl.origin}/favicon.ico`,
    }
  }
}

// ==========================================
// MCP Protocol Definitions & Tools Registry
// ==========================================

export const MCP_TOOLS_LIST = [
  {
    name: 'get_itab_overview',
    description:
      '获取 iTab 全局站点提示词与完整的分类列表（包含分类 ID、名称、图标、公开状态、分享链接、书签数量及分类级 AI 提示词）',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_bookmarks',
    description:
      '根据分类 ID 或关键字搜索书签，返回符合条件的书签详情及对应的卡片级 AI 提示词（Bookmark AI Prompt）',
    inputSchema: {
      type: 'object',
      properties: {
        category_id: {
          type: 'number',
          description: '可选：指定分类 ID 筛选',
        },
        keyword: {
          type: 'string',
          description: '可选：按标题、网址、备注或 AI 提示词模糊检索',
        },
      },
    },
  },
  {
    name: 'get_bookmark_agent_playbook',
    description:
      '获取针对特定书签的完整 AI Agent 复合操作指南 (Composite Playbook)。将全局系统提示词、分类级提示词与书签专属提示词融合成结构化执行上下文，指导浏览器或代码 Agent 准确操作目标网站',
    inputSchema: {
      type: 'object',
      properties: {
        bookmark_id: {
          type: 'number',
          description: '书签 ID（优先根据 ID 检索）',
        },
        url: {
          type: 'string',
          description: '网址（如果未提供 bookmark_id，可通过 URL 精确或模糊匹配）',
        },
      },
    },
  },
  {
    name: 'manage_category',
    description:
      '管理 iTab 分类目录：支持创建(create)、更新(update)、删除(delete)以及批量重排(reorder)',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete', 'reorder'],
          description: '操作类型: create | update | delete | reorder',
        },
        id: {
          type: 'number',
          description: '分类 ID（更新或删除时必需）',
        },
        name: {
          type: 'string',
          description: '分类名称',
        },
        icon: {
          type: 'string',
          description: '分类图标（例如: Folder, Sparkles, Code2, Globe, etc.）',
        },
        ai_prompt: {
          type: 'string',
          description: '分类级 AI 专属提示词',
        },
        is_public: {
          type: 'boolean',
          description: '是否公开分享（true: 1, false: 0）',
        },
        share_slug: {
          type: 'string',
          description: '公开分享的自定义 Slug 后缀',
        },
        share_description: {
          type: 'string',
          description: '公开分享描述信息',
        },
        ordered_ids: {
          type: 'array',
          items: { type: 'number' },
          description: '批量重排时依次传入所有分类 ID 数组',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_bookmark',
    description:
      '管理 iTab 书签：支持创建(create)、更新(update)、删除(delete)以及移动(move)。创建时如省略 title 或 remark，系统将自动通过 HTMLRewriter 抓取网页并补充',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete', 'move'],
          description: '操作类型: create | update | delete | move',
        },
        id: {
          type: 'number',
          description: '书签 ID（更新、删除或移动时必需）',
        },
        category_id: {
          type: 'number',
          description: '所属分类 ID',
        },
        title: {
          type: 'string',
          description: '书签标题（创建时若省略将自动通过爬虫抓取）',
        },
        url: {
          type: 'string',
          description: '目标网址（例如: https://github.com）',
        },
        remark: {
          type: 'string',
          description: '书签备注或简短描述（创建时若省略将自动抓取）',
        },
        custom_icon_url: {
          type: 'string',
          description: '自定义图标图片 URL',
        },
        ai_prompt: {
          type: 'string',
          description: '书签卡片级 AI 专属提示词与操作 SOP 指令',
        },
        sort_order: {
          type: 'number',
          description: '排序序号',
        },
      },
      required: ['action'],
    },
  },
]

export const MCP_PROMPTS_LIST = [
  {
    name: 'itab_system_guide',
    description: '获取 iTab 导航站全局系统指引与分类目录，帮助 Agent 理解导航架构与使用规范',
    arguments: [],
  },
]

// ==========================================
// MCP Tool Implementations
// ==========================================

async function executeToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
  env: Env
): Promise<{ text: string; isError: boolean }> {
  const db = env.DB

  switch (name) {
    case 'get_itab_overview': {
      const globalPrompt = await getGlobalAgentPrompt(db)
      const { results: categories } = await db
        .prepare(
          `SELECT 
            c.id, 
            c.name, 
            c.icon, 
            c.sort_order, 
            c.is_public, 
            c.share_slug, 
            c.share_description, 
            COALESCE(c.ai_prompt, '') as ai_prompt,
            COUNT(b.id) as bookmark_count
          FROM categories c
          LEFT JOIN bookmarks b ON b.category_id = c.id
          GROUP BY c.id
          ORDER BY c.sort_order ASC, c.id ASC`
        )
        .all()

      return {
        text: JSON.stringify(
          {
            global_agent_prompt: globalPrompt,
            total_categories: categories?.length || 0,
            categories: categories || [],
          },
          null,
          2
        ),
        isError: false,
      }
    }

    case 'search_bookmarks': {
      const categoryId = args?.category_id as number | undefined
      const keyword = (args?.keyword as string | undefined)?.trim()

      let query = `
        SELECT 
          b.id, 
          b.category_id, 
          c.name as category_name, 
          b.title, 
          b.url, 
          COALESCE(b.remark, '') as remark, 
          COALESCE(b.custom_icon_url, '') as custom_icon_url,
          COALESCE(b.ai_prompt, '') as ai_prompt, 
          b.sort_order
        FROM bookmarks b
        JOIN categories c ON c.id = b.category_id
        WHERE 1=1
      `
      const bindParams: (string | number)[] = []

      if (categoryId !== undefined && categoryId !== null) {
        query += ' AND b.category_id = ?'
        bindParams.push(categoryId)
      }

      if (keyword) {
        query += ' AND (b.title LIKE ? OR b.url LIKE ? OR b.remark LIKE ? OR b.ai_prompt LIKE ?)'
        const pattern = `%${keyword}%`
        bindParams.push(pattern, pattern, pattern, pattern)
      }

      query += ' ORDER BY c.sort_order ASC, b.sort_order ASC, b.id ASC'

      const stmt = db.prepare(query)
      const { results } = bindParams.length > 0 ? await stmt.bind(...bindParams).all() : await stmt.all()

      return {
        text: JSON.stringify(
          {
            total: results?.length || 0,
            filter: { category_id: categoryId, keyword },
            bookmarks: results || [],
          },
          null,
          2
        ),
        isError: false,
      }
    }

    case 'get_bookmark_agent_playbook': {
      const bookmarkId = args?.bookmark_id as number | undefined
      const url = (args?.url as string | undefined)?.trim()

      if (!bookmarkId && !url) {
        return {
          text: 'Error: Must provide either bookmark_id or url to fetch agent playbook',
          isError: true,
        }
      }

      let bookmarkRow: {
        id: number
        category_id: number
        title: string
        url: string
        remark: string
        custom_icon_url: string
        ai_prompt: string
        category_name: string
        category_icon: string
        category_ai_prompt: string
      } | null = null

      if (bookmarkId) {
        bookmarkRow = await db
          .prepare(
            `SELECT 
              b.id, b.category_id, b.title, b.url, 
              COALESCE(b.remark, '') as remark, 
              COALESCE(b.custom_icon_url, '') as custom_icon_url,
              COALESCE(b.ai_prompt, '') as ai_prompt,
              c.name as category_name,
              c.icon as category_icon,
              COALESCE(c.ai_prompt, '') as category_ai_prompt
            FROM bookmarks b
            JOIN categories c ON c.id = b.category_id
            WHERE b.id = ?`
          )
          .bind(bookmarkId)
          .first()
      } else if (url) {
        let cleanUrl = url
        if (!/^https?:\/\//i.test(cleanUrl)) {
          cleanUrl = 'https://' + cleanUrl
        }
        bookmarkRow = await db
          .prepare(
            `SELECT 
              b.id, b.category_id, b.title, b.url, 
              COALESCE(b.remark, '') as remark, 
              COALESCE(b.custom_icon_url, '') as custom_icon_url,
              COALESCE(b.ai_prompt, '') as ai_prompt,
              c.name as category_name,
              c.icon as category_icon,
              COALESCE(c.ai_prompt, '') as category_ai_prompt
            FROM bookmarks b
            JOIN categories c ON c.id = b.category_id
            WHERE b.url = ? OR b.url LIKE ?
            ORDER BY b.id ASC LIMIT 1`
          )
          .bind(cleanUrl, `%${url}%`)
          .first()
      }

      if (!bookmarkRow) {
        return {
          text: `Error: No matching bookmark found for bookmark_id=${bookmarkId} url=${url}`,
          isError: true,
        }
      }

      const globalPrompt = await getGlobalAgentPrompt(db)

      const markdownPlaybook = [
        `# AI Agent Playbook: ${bookmarkRow.title}`,
        '',
        `> **Target URL**: [${bookmarkRow.url}](${bookmarkRow.url})`,
        `> **Category**: ${bookmarkRow.category_name}`,
        bookmarkRow.remark ? `> **Remark**: ${bookmarkRow.remark}` : '',
        '',
        '---',
        '## 🏛 1. Global System Guidelines (Tier 1)',
        globalPrompt,
        '',
        '---',
        `## 📂 2. Category Operational Guidelines (Tier 2: ${bookmarkRow.category_name})`,
        bookmarkRow.category_ai_prompt.trim()
          ? bookmarkRow.category_ai_prompt
          : '*(无特定分类级提示词)*',
        '',
        '---',
        '## 🎯 3. Bookmark SOP & Specific Execution Prompt (Tier 3)',
        bookmarkRow.ai_prompt.trim()
          ? bookmarkRow.ai_prompt
          : '*(无专属书签提示词，请依据通用规则与目标页面结构执行自动化操作)*',
        '',
        '---',
        '## 🚀 Recommended Agent Action Checklist',
        `1. Open browser / HTTP client to target: \`${bookmarkRow.url}\``,
        `2. Respect Tier 2 and Tier 3 SOP instructions above.`,
        `3. Report actions or extracted data back according to user objective.`,
      ].filter(Boolean).join('\n')

      return {
        text: JSON.stringify(
          {
            bookmark: {
              id: bookmarkRow.id,
              category_id: bookmarkRow.category_id,
              category_name: bookmarkRow.category_name,
              title: bookmarkRow.title,
              url: bookmarkRow.url,
              remark: bookmarkRow.remark,
              ai_prompt: bookmarkRow.ai_prompt,
            },
            prompts: {
              tier1_global_prompt: globalPrompt,
              tier2_category_prompt: bookmarkRow.category_ai_prompt,
              tier3_bookmark_prompt: bookmarkRow.ai_prompt,
            },
            composite_playbook_markdown: markdownPlaybook,
          },
          null,
          2
        ),
        isError: false,
      }
    }

    case 'manage_category': {
      const action = args?.action as string
      if (!action) {
        return { text: 'Error: Missing required argument "action"', isError: true }
      }

      if (action === 'create') {
        const name = (args?.name as string | undefined)?.trim()
        if (!name) return { text: 'Error: Category name is required for create', isError: true }
        const icon = (args?.icon as string | undefined)?.trim() || 'Folder'
        const aiPrompt = (args?.ai_prompt as string | undefined)?.trim() || ''
        const isPublic = args?.is_public ? 1 : 0
        const shareSlug = (args?.share_slug as string | undefined)?.trim() || null
        const shareDesc = (args?.share_description as string | undefined)?.trim() || ''

        const maxRow = await db
          .prepare('SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM categories')
          .first<{ max_sort: number }>()
        const nextSort = (maxRow?.max_sort ?? -1) + 1

        const created = await db
          .prepare(
            `INSERT INTO categories 
              (name, icon, sort_order, is_public, share_slug, share_description, ai_prompt) 
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
          )
          .bind(name, icon, nextSort, isPublic, isPublic ? shareSlug : null, shareDesc, aiPrompt)
          .first()

        return {
          text: JSON.stringify({ success: true, action: 'create', category: created }, null, 2),
          isError: false,
        }
      }

      if (action === 'update') {
        const id = args?.id as number | undefined
        if (!id) return { text: 'Error: Category id is required for update', isError: true }

        const existing = await db
          .prepare('SELECT * FROM categories WHERE id = ?')
          .bind(id)
          .first<{
            id: number
            name: string
            icon: string
            is_public: number
            share_slug: string | null
            share_description: string
            ai_prompt: string
          }>()
        if (!existing) return { text: `Error: Category id ${id} not found`, isError: true }

        const newName = args?.name !== undefined ? String(args.name).trim() : existing.name
        const newIcon = args?.icon !== undefined ? String(args.icon).trim() : existing.icon
        const newAiPrompt =
          args?.ai_prompt !== undefined ? String(args.ai_prompt).trim() : (existing.ai_prompt || '')
        const newIsPublic =
          args?.is_public !== undefined ? (args.is_public ? 1 : 0) : existing.is_public
        let newShareSlug =
          args?.share_slug !== undefined
            ? (String(args.share_slug).trim() || null)
            : existing.share_slug
        const newShareDesc =
          args?.share_description !== undefined
            ? String(args.share_description).trim()
            : existing.share_description

        if (newIsPublic && !newShareSlug) {
          newShareSlug = Math.random().toString(36).substring(2, 10)
        }

        const updated = await db
          .prepare(
            `UPDATE categories 
            SET name = ?, icon = ?, is_public = ?, share_slug = ?, share_description = ?, ai_prompt = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? RETURNING *`
          )
          .bind(
            newName,
            newIcon,
            newIsPublic,
            newIsPublic ? newShareSlug : null,
            newShareDesc,
            newAiPrompt,
            id
          )
          .first()

        return {
          text: JSON.stringify({ success: true, action: 'update', category: updated }, null, 2),
          isError: false,
        }
      }

      if (action === 'delete') {
        const id = args?.id as number | undefined
        if (!id) return { text: 'Error: Category id is required for delete', isError: true }

        const delBookmarks = db.prepare('DELETE FROM bookmarks WHERE category_id = ?').bind(id)
        const delCategory = db.prepare('DELETE FROM categories WHERE id = ?').bind(id)
        await db.batch([delBookmarks, delCategory])

        return {
          text: JSON.stringify({ success: true, action: 'delete', id }, null, 2),
          isError: false,
        }
      }

      if (action === 'reorder') {
        const orderedIds = args?.ordered_ids as number[] | undefined
        if (!orderedIds || !Array.isArray(orderedIds)) {
          return { text: 'Error: ordered_ids array is required for reorder', isError: true }
        }

        const statements = orderedIds.map((catId, index) =>
          db
            .prepare(
              'UPDATE categories SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            )
            .bind(index, catId)
        )

        if (statements.length > 0) {
          await db.batch(statements)
        }

        return {
          text: JSON.stringify(
            { success: true, action: 'reorder', count: orderedIds.length },
            null,
            2
          ),
          isError: false,
        }
      }

      return { text: `Error: Unsupported category action "${action}"`, isError: true }
    }

    case 'manage_bookmark': {
      const action = args?.action as string
      if (!action) {
        return { text: 'Error: Missing required argument "action"', isError: true }
      }

      if (action === 'create') {
        let rawUrl = (args?.url as string | undefined)?.trim()
        if (!rawUrl) return { text: 'Error: URL is required to create a bookmark', isError: true }
        if (!/^https?:\/\//i.test(rawUrl)) {
          rawUrl = 'https://' + rawUrl
        }

        let categoryId = args?.category_id as number | undefined
        if (!categoryId) {
          const firstCat = await db
            .prepare('SELECT id FROM categories ORDER BY sort_order ASC, id ASC LIMIT 1')
            .first<{ id: number }>()
          categoryId = firstCat?.id ?? 1
        }

        let title = (args?.title as string | undefined)?.trim()
        let remark = (args?.remark as string | undefined)?.trim()
        let customIconUrl = (args?.custom_icon_url as string | undefined)?.trim() || ''
        const aiPrompt = (args?.ai_prompt as string | undefined)?.trim() || ''

        // Auto-scrape metadata if title or remark is missing
        if (!title || !remark) {
          const scraped = await scrapeWebMeta(rawUrl)
          if (!title) title = scraped.title || rawUrl
          if (!remark) remark = scraped.description || ''
          if (!customIconUrl && scraped.favicon) customIconUrl = scraped.favicon
        }

        const maxRow = await db
          .prepare(
            'SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM bookmarks WHERE category_id = ?'
          )
          .bind(categoryId)
          .first<{ max_sort: number }>()
        const nextSort = (maxRow?.max_sort ?? -1) + 1

        const created = await db
          .prepare(
            `INSERT INTO bookmarks 
              (category_id, title, url, remark, custom_icon_url, sort_order, ai_prompt) 
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
          )
          .bind(
            categoryId,
            title,
            rawUrl,
            remark || '',
            customIconUrl || '',
            args?.sort_order !== undefined ? Number(args.sort_order) : nextSort,
            aiPrompt
          )
          .first()

        return {
          text: JSON.stringify({ success: true, action: 'create', bookmark: created }, null, 2),
          isError: false,
        }
      }

      if (action === 'update') {
        const id = args?.id as number | undefined
        if (!id) return { text: 'Error: Bookmark id is required for update', isError: true }

        let rawUrl = args?.url !== undefined ? String(args.url).trim() : null
        if (rawUrl && !/^https?:\/\//i.test(rawUrl)) {
          rawUrl = 'https://' + rawUrl
        }

        const updated = await db
          .prepare(
            `UPDATE bookmarks SET 
              category_id = COALESCE(?, category_id),
              title = COALESCE(?, title),
              url = COALESCE(?, url),
              remark = COALESCE(?, remark),
              custom_icon_url = COALESCE(?, custom_icon_url),
              ai_prompt = COALESCE(?, ai_prompt),
              sort_order = COALESCE(?, sort_order),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ? RETURNING *`
          )
          .bind(
            args?.category_id ?? null,
            args?.title !== undefined ? String(args.title).trim() : null,
            rawUrl,
            args?.remark !== undefined ? String(args.remark).trim() : null,
            args?.custom_icon_url !== undefined ? String(args.custom_icon_url).trim() : null,
            args?.ai_prompt !== undefined ? String(args.ai_prompt).trim() : null,
            args?.sort_order !== undefined ? Number(args.sort_order) : null,
            id
          )
          .first()

        if (!updated) {
          return { text: `Error: Bookmark with id ${id} not found`, isError: true }
        }

        return {
          text: JSON.stringify({ success: true, action: 'update', bookmark: updated }, null, 2),
          isError: false,
        }
      }

      if (action === 'delete') {
        const id = args?.id as number | undefined
        if (!id) return { text: 'Error: Bookmark id is required for delete', isError: true }

        await db.prepare('DELETE FROM bookmarks WHERE id = ?').bind(id).run()
        return {
          text: JSON.stringify({ success: true, action: 'delete', id }, null, 2),
          isError: false,
        }
      }

      if (action === 'move') {
        const id = args?.id as number | undefined
        const targetCategoryId = args?.category_id as number | undefined
        if (!id || !targetCategoryId) {
          return {
            text: 'Error: Both id and category_id are required for move action',
            isError: true,
          }
        }

        const updated = await db
          .prepare(
            `UPDATE bookmarks SET 
              category_id = ?, 
              sort_order = COALESCE(?, sort_order),
              updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? RETURNING *`
          )
          .bind(
            targetCategoryId,
            args?.sort_order !== undefined ? Number(args.sort_order) : null,
            id
          )
          .first()

        return {
          text: JSON.stringify({ success: true, action: 'move', bookmark: updated }, null, 2),
          isError: false,
        }
      }

      return { text: `Error: Unsupported bookmark action "${action}"`, isError: true }
    }

    default:
      return { text: `Error: Unknown tool "${name}"`, isError: true }
  }
}

// ==========================================
// MCP JSON-RPC 2.0 Dispatcher
// ==========================================

export async function handleMcpJsonRpc(
  body: Record<string, unknown>,
  env: Env
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const { id, method, params } = body

  // Notification handling (no id)
  const isNotification = id === undefined || id === null

  if (method === 'initialize') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id: isNotification ? 1 : id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'iTab-MCP-Server',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
            prompts: {},
          },
        },
      },
    }
  }

  if (method === 'notifications/initialized') {
    if (isNotification) return { status: 204, body: null }
    return {
      status: 200,
      body: { jsonrpc: '2.0', id, result: {} },
    }
  }

  if (method === 'ping') {
    return {
      status: 200,
      body: { jsonrpc: '2.0', id: isNotification ? 1 : id, result: {} },
    }
  }

  if (method === 'prompts/list') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id: isNotification ? 1 : id,
        result: {
          prompts: MCP_PROMPTS_LIST,
        },
      },
    }
  }

  if (method === 'prompts/get') {
    const promptName = (params as { name?: string })?.name
    if (promptName === 'itab_system_guide') {
      const globalPrompt = await getGlobalAgentPrompt(env.DB)
      const { results: categories } = await env.DB
        .prepare(
          'SELECT id, name, icon, ai_prompt FROM categories ORDER BY sort_order ASC, id ASC'
        )
        .all<{ id: number; name: string; icon: string; ai_prompt?: string }>()

      const catListText = (categories || [])
        .map(
          (c) =>
            `- [ID: ${c.id}] ${c.name} (${c.icon})\n  AI 指南: ${c.ai_prompt?.trim() || '(无特定分类级提示词)'}`
        )
        .join('\n')

      const guideText = [
        '# iTab 全局系统指引与分类目录',
        '',
        '## 一级全局指令 (Global Agent Prompt):',
        globalPrompt,
        '',
        '## 二级分类目录与分类指令:',
        catListText,
        '',
        '提示：在访问具体网址前，可通过 `get_bookmark_agent_playbook` 获取完整的复合操作 SOP。',
      ].join('\n')

      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id: isNotification ? 1 : id,
          result: {
            description: 'iTab 全局系统指引与分类目录',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: guideText,
                },
              },
            ],
          },
        },
      }
    }

    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id: isNotification ? 1 : id,
        error: {
          code: -32602,
          message: `Prompt not found: ${promptName}`,
        },
      },
    }
  }

  if (method === 'tools/list') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id: isNotification ? 1 : id,
        result: {
          tools: MCP_TOOLS_LIST,
        },
      },
    }
  }

  if (method === 'tools/call') {
    const p = (params as { name?: string; arguments?: Record<string, unknown> }) || {}
    if (!p.name) {
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id: isNotification ? 1 : id,
          error: { code: -32602, message: 'Missing tool name' },
        },
      }
    }

    try {
      const toolResult = await executeToolCall(p.name, p.arguments, env)
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id: isNotification ? 1 : id,
          result: {
            content: [
              {
                type: 'text',
                text: toolResult.text,
              },
            ],
            isError: toolResult.isError,
          },
        },
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tool call failed'
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id: isNotification ? 1 : id,
          result: {
            content: [
              {
                type: 'text',
                text: `Execution Exception: ${message}`,
              },
            ],
            isError: true,
          },
        },
      }
    }
  }

  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      id: isNotification ? 1 : id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    },
  }
}

// ==========================================
// LLMS.txt Context Generators
// ==========================================

export async function generatePrivateLlmsTxt(db: D1Database, host: string): Promise<string> {
  const globalPrompt = await getGlobalAgentPrompt(db)

  const { results: categories } = await db
    .prepare(
      'SELECT id, name, icon, is_public, share_slug, share_description, ai_prompt FROM categories ORDER BY sort_order ASC, id ASC'
    )
    .all<{
      id: number
      name: string
      icon: string
      is_public: number
      share_slug: string | null
      share_description: string
      ai_prompt: string
    }>()

  const { results: bookmarks } = await db
    .prepare(
      'SELECT id, category_id, title, url, remark, ai_prompt FROM bookmarks ORDER BY category_id ASC, sort_order ASC, id ASC'
    )
    .all<{
      id: number
      category_id: number
      title: string
      url: string
      remark: string
      ai_prompt: string
    }>()

  const bookmarksByCat = new Map<number, typeof bookmarks>()
  for (const bm of bookmarks || []) {
    const list = bookmarksByCat.get(bm.category_id) || []
    list.push(bm)
    bookmarksByCat.set(bm.category_id, list)
  }

  const lines: string[] = [
    '# iTab AI Agent Playbook & Navigation Index',
    '',
    `> Generated by iTab MCP System on ${new Date().toISOString()}`,
    `> Host: ${host}`,
    '',
    '## 🏛 1. Global System Guidelines (Tier 1)',
    globalPrompt,
    '',
    '## 📂 2. Categories & Bookmarks Directory',
    '',
  ]

  for (const cat of categories || []) {
    lines.push(`### Category: ${cat.name} (ID: ${cat.id})`)
    lines.push(`- **Icon**: ${cat.icon}`)
    lines.push(`- **Public**: ${cat.is_public ? `Yes (Slug: /s/${cat.share_slug})` : 'No'}`)
    if (cat.share_description) lines.push(`- **Description**: ${cat.share_description}`)
    lines.push(
      `- **Category AI Prompt (Tier 2)**: ${cat.ai_prompt?.trim() || '(无特定分类级提示词)'}`
    )
    lines.push('')

    const catBookmarks = bookmarksByCat.get(cat.id) || []
    if (catBookmarks.length === 0) {
      lines.push('*(此分类下暂无书签)*')
    } else {
      lines.push('#### Bookmarks:')
      for (const bm of catBookmarks) {
        lines.push(`- **[${bm.title}](${bm.url})** (ID: ${bm.id})`)
        if (bm.remark) lines.push(`  - **Remark**: ${bm.remark}`)
        if (bm.ai_prompt?.trim()) {
          lines.push(`  - **Bookmark AI Prompt (Tier 3 SOP)**: ${bm.ai_prompt.trim()}`)
        }
      }
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

export async function generatePublicLlmsTxt(
  db: D1Database,
  slug: string,
  host: string
): Promise<string | null> {
  const category = await db
    .prepare(
      'SELECT id, name, icon, share_slug, share_description, ai_prompt FROM categories WHERE share_slug = ? AND is_public = 1'
    )
    .bind(slug)
    .first<{
      id: number
      name: string
      icon: string
      share_slug: string
      share_description: string
      ai_prompt: string
    }>()

  if (!category) return null

  const { results: bookmarks } = await db
    .prepare(
      'SELECT id, title, url, remark, ai_prompt FROM bookmarks WHERE category_id = ? ORDER BY sort_order ASC, id ASC'
    )
    .bind(category.id)
    .all<{
      id: number
      title: string
      url: string
      remark: string
      ai_prompt: string
    }>()

  const lines: string[] = [
    `# iTab Public Shared Collection: ${category.name}`,
    '',
    `> Public Collection shared via iTab at ${host}`,
    `> Share URL: https://${host}/s/${category.share_slug}`,
    '',
    '## Category Information',
    `- **Name**: ${category.name}`,
    `- **Icon**: ${category.icon}`,
    category.share_description ? `- **Description**: ${category.share_description}` : '',
    '',
    '## Category AI Operational Guidelines',
    category.ai_prompt?.trim()
      ? category.ai_prompt.trim()
      : '*(本公开分类无特定 AI 提示词)*',
    '',
    '## Bookmarks in this Collection',
    '',
  ]

  for (const bm of bookmarks || []) {
    lines.push(`### [${bm.title}](${bm.url})`)
    if (bm.remark) lines.push(`- **Remark**: ${bm.remark}`)
    if (bm.ai_prompt?.trim()) {
      lines.push(`- **AI Agent SOP & Prompt**: ${bm.ai_prompt.trim()}`)
    }
    lines.push('')
  }

  return lines.filter(Boolean).join('\n')
}
