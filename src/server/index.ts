import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import {
  getExpectedMcpToken,
  validateMcpAuth,
  getGlobalAgentPrompt,
  handleMcpJsonRpc,
  generatePrivateLlmsTxt,
  generatePublicLlmsTxt,
} from './mcp'

export interface Env {
  DB: D1Database
  ASSETS?: Fetcher
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  JWT_SECRET?: string
  MCP_API_TOKEN?: string
}

const app = new Hono<{ Bindings: Env }>()

// CORS for cross-origin local dev if needed
app.use('*', cors())

// Auth middleware for protected routes
app.use('/api/*', async (c, next) => {
  const path = c.req.path
  // Allow public and MCP/LLMs endpoints (they handle their own auth)
  if (
    path === '/api/auth/login' ||
    path.startsWith('/api/public/') ||
    path === '/api/meta' ||
    path === '/api/mcp' ||
    path === '/api/llms.txt'
  ) {
    return next()
  }

  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401)
  }

  const token = authHeader.substring(7)
  const secret = c.env.JWT_SECRET || 'itab_default_fallback_secret_key_32chars'
  try {
    const payload = await verify(token, secret, 'HS256')
    c.set('jwtPayload', payload)
    return next()
  } catch {
    return c.json({ error: 'Unauthorized: Token expired or invalid' }, 401)
  }
})

// ==========================================
// 1. Authentication Endpoints
// ==========================================
// Rate limiting map for login attempts: clientIp -> timestamp (ms)
const loginRateLimitMap = new Map<string, number>()
const LOGIN_RATE_LIMIT_MS = 2000

app.post('/api/auth/login', async (c) => {
  // 1. Rate limiting check (at most 1 attempt per 2 seconds per IP)
  const clientIp =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-real-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1'

  const now = Date.now()
  const lastAttempt = loginRateLimitMap.get(clientIp) || 0
  const elapsed = now - lastAttempt

  if (elapsed < LOGIN_RATE_LIMIT_MS) {
    console.warn(`[Apple] Rate limit triggered for IP ${clientIp} on /api/auth/login: ${elapsed}ms < ${LOGIN_RATE_LIMIT_MS}ms`)
    const waitSeconds = Math.max(1, Math.ceil((LOGIN_RATE_LIMIT_MS - elapsed) / 1000))
    c.header('Retry-After', String(waitSeconds))
    return c.json(
      {
        error: `安全防护生效中：登录过于频繁，每 2 秒仅能尝试一次（请等待 ${waitSeconds} 秒后再试）`,
      },
      429
    )
  }

  // Update attempt timestamp
  loginRateLimitMap.set(clientIp, now)

  // Prune map if it gets too large
  if (loginRateLimitMap.size > 1000) {
    const expiredCutoff = now - 60000
    for (const [ip, ts] of loginRateLimitMap.entries()) {
      if (ts < expiredCutoff) {
        loginRateLimitMap.delete(ip)
      }
    }
  }

  try {
    const body = await c.req.json<{
      username?: string
      password?: string
      isTemporary?: boolean
    }>()

    const expectedUser = c.env?.ADMIN_USERNAME || 'admin'
    const expectedPass = c.env?.ADMIN_PASSWORD || 'admin123'
    const secret = c.env?.JWT_SECRET || 'itab_default_fallback_secret_key_32chars'

    if (body.username !== expectedUser || body.password !== expectedPass) {
      return c.json({ error: '用户名或密码不正确' }, 401)
    }

    const nowSec = Math.floor(now / 1000)
    const isTemporary = Boolean(body.isTemporary)
    // 2 hours for temporary mode, 30 days for persistent mode
    const duration = isTemporary ? 2 * 60 * 60 : 30 * 24 * 60 * 60
    const exp = nowSec + duration

    const payload = {
      sub: body.username,
      mode: isTemporary ? 'temporary' : 'persistent',
      exp,
      iat: nowSec,
    }

    const token = await sign(payload, secret)

    return c.json({
      token,
      expiresAt: exp * 1000,
      mode: isTemporary ? 'temporary' : 'persistent',
    })
  } catch (err: unknown) {
    console.error('[Apple] Login error caught:', err)
    return c.json({ error: '无效的登录请求' }, 400)
  }
})

// ==========================================
// 2. Public Read-Only Share Endpoints
// ==========================================
app.get('/api/public/s/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!slug) {
    return c.json({ error: 'Slug is required' }, 400)
  }

  try {
    const category = await c.env.DB
      .prepare(`SELECT id, name, icon, sort_order, is_public, share_slug, share_description, COALESCE(ai_prompt, '') as ai_prompt FROM categories WHERE share_slug = ? AND is_public = 1`)
      .bind(slug)
      .first<{
        id: number
        name: string
        icon: string
        sort_order: number
        is_public: number
        share_slug: string
        share_description: string
        ai_prompt: string
      }>()

    if (!category) {
      return c.json({ error: '分享分类不存在或已被取消公开' }, 404)
    }

    const { results: bookmarks } = await c.env.DB
      .prepare(`SELECT id, category_id, title, url, remark, custom_icon_url, sort_order, COALESCE(ai_prompt, '') as ai_prompt FROM bookmarks WHERE category_id = ? ORDER BY sort_order ASC, id ASC`)
      .bind(category.id)
      .all()

    c.header('Cache-Control', 'public, max-age=60, s-maxage=300')
    return c.json({
      category,
      bookmarks,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown database error'
    return c.json({ error: 'Failed to fetch public category', details: message }, 500)
  }
})

// Public Read-Only llms.txt context
app.get('/api/public/s/:slug/llms.txt', async (c) => {
  const slug = c.req.param('slug')
  if (!slug) {
    return c.text('Slug is required', 400)
  }

  try {
    const host = c.req.header('host') || 'itab.local'
    const markdown = await generatePublicLlmsTxt(c.env.DB, slug, host)
    if (!markdown) {
      return c.text('分享分类不存在或已被取消公开', 404)
    }

    c.header('Content-Type', 'text/plain; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=60, s-maxage=300')
    return c.text(markdown)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.text(`Failed to generate public llms.txt: ${message}`, 500)
  }
})

// ==========================================
// 3. Webpage Metadata Scraper with HTMLRewriter
// ==========================================
app.get('/api/meta', async (c) => {
  let rawUrl = c.req.query('url')
  if (!rawUrl) {
    return c.json({ error: 'Missing url parameter' }, 400)
  }

  // Prepend https:// if protocol is omitted
  if (!/^https?:\/\//i.test(rawUrl)) {
    rawUrl = 'https://' + rawUrl
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return c.json({ error: 'Invalid URL format' }, 400)
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
    // Consume the transformed stream to trigger HTMLRewriter callbacks
    await transformed.text()

    title = title.trim() || parsedUrl.hostname
    description = description.trim()

    // Resolve relative icon URL to absolute
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

    c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    return c.json({
      title,
      description,
      favicon: icon,
    })
  } catch {
    // Graceful fallback on network timeout or fetch error
    return c.json({
      title: parsedUrl.hostname,
      description: '',
      favicon: `${parsedUrl.origin}/favicon.ico`,
    })
  }
})

// ==========================================
// 4. Single-Query Bootstrap Endpoint
// ==========================================
app.get('/api/bootstrap', async (c) => {
  try {
    const catStmt = c.env.DB.prepare(
      'SELECT id, name, icon, sort_order, is_public, share_slug, share_description, COALESCE(ai_prompt, "") as ai_prompt, created_at, updated_at FROM categories ORDER BY sort_order ASC, id ASC'
    )
    const bmStmt = c.env.DB.prepare(
      'SELECT id, category_id, title, url, remark, custom_icon_url, sort_order, COALESCE(ai_prompt, "") as ai_prompt, created_at, updated_at FROM bookmarks ORDER BY category_id ASC, sort_order ASC, id ASC'
    )

    const [catResult, bmResult] = await c.env.DB.batch([catStmt, bmStmt])
    const globalAgentPrompt = await getGlobalAgentPrompt(c.env.DB)

    // Check session mode: only return mcp_token in persistent (non-temporary) mode
    const payload = c.get('jwtPayload') as { mode?: string } | undefined
    let mcpToken: string | undefined = undefined
    if (payload?.mode !== 'temporary') {
      mcpToken = await getExpectedMcpToken(c.env)
    }

    return c.json({
      categories: catResult.results || [],
      bookmarks: bmResult.results || [],
      global_agent_prompt: globalAgentPrompt,
      mcp_token: mcpToken,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown database error'
    return c.json({ error: 'Failed to bootstrap data', details: message }, 500)
  }
})

// Update global agent prompt
app.put('/api/config/ai', async (c) => {
  try {
    const body = await c.req.json<{ global_agent_prompt?: string }>()
    const prompt =
      body.global_agent_prompt !== undefined ? String(body.global_agent_prompt).trim() : ''

    await c.env.DB
      .prepare(
        `INSERT INTO site_config (key, value, updated_at) VALUES ('global_agent_prompt', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
      )
      .bind(prompt)
      .run()

    return c.json({ success: true, global_agent_prompt: prompt })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '保存全局提示词失败', details: message }, 500)
  }
})

// ==========================================
// 5. Category Management Endpoints
// ==========================================
app.post('/api/categories', async (c) => {
  try {
    const body = await c.req.json<{ name: string; icon?: string; ai_prompt?: string }>()
    if (!body.name || !body.name.trim()) {
      return c.json({ error: '分类名称不能为空' }, 400)
    }

    const name = body.name.trim()
    const icon = body.icon?.trim() || 'Folder'
    const aiPrompt = body.ai_prompt?.trim() || ''

    // Get max sort_order
    const maxRow = await c.env.DB
      .prepare('SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM categories')
      .first<{ max_sort: number }>()
    const nextSort = (maxRow?.max_sort ?? -1) + 1

    const result = await c.env.DB
      .prepare(
        'INSERT INTO categories (name, icon, sort_order, is_public, share_slug, share_description, ai_prompt) VALUES (?, ?, ?, 0, NULL, ?, ?) RETURNING *'
      )
      .bind(name, icon, nextSort, '', aiPrompt)
      .first()

    return c.json(result, 201)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '创建分类失败', details: message }, 500)
  }
})

app.put('/api/categories/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid ID' }, 400)

  try {
    const body = await c.req.json<{ name?: string; icon?: string; ai_prompt?: string }>()
    const name = body.name?.trim()
    const icon = body.icon?.trim()

    if (!name) {
      return c.json({ error: '分类名称不能为空' }, 400)
    }

    const updated = await c.env.DB
      .prepare(
        `UPDATE categories SET 
          name = ?, 
          icon = COALESCE(?, icon), 
          ai_prompt = COALESCE(?, ai_prompt),
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? RETURNING *`
      )
      .bind(
        name,
        icon || null,
        body.ai_prompt !== undefined ? body.ai_prompt.trim() : null,
        id
      )
      .first()

    if (!updated) {
      return c.json({ error: '分类不存在' }, 404)
    }

    return c.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '更新分类失败', details: message }, 500)
  }
})

app.delete('/api/categories/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid ID' }, 400)

  try {
    // Delete bookmarks in category then category itself in batch
    const delBookmarks = c.env.DB.prepare('DELETE FROM bookmarks WHERE category_id = ?').bind(id)
    const delCategory = c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id)
    await c.env.DB.batch([delBookmarks, delCategory])

    return c.json({ success: true, id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '删除分类失败', details: message }, 500)
  }
})

// Toggle public share for category
app.put('/api/categories/:id/share', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid ID' }, 400)

  try {
    const body = await c.req.json<{
      is_public: boolean | number
      share_slug?: string | null
      share_description?: string
    }>()

    const isPublic = body.is_public ? 1 : 0
    let slug = body.share_slug?.trim() || null
    const desc = body.share_description?.trim() || ''

    if (isPublic && !slug) {
      // Auto-generate 8-character random slug
      slug = Math.random().toString(36).substring(2, 10)
    }

    // Verify slug uniqueness if public
    if (isPublic && slug) {
      const existing = await c.env.DB
        .prepare('SELECT id FROM categories WHERE share_slug = ? AND id != ?')
        .bind(slug, id)
        .first()
      if (existing) {
        return c.json({ error: '该分享后缀已存在，请更换其他后缀' }, 409)
      }
    }

    const updated = await c.env.DB
      .prepare('UPDATE categories SET is_public = ?, share_slug = ?, share_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *')
      .bind(isPublic, isPublic ? slug : null, desc, id)
      .first()

    return c.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '更新分享设置失败', details: message }, 500)
  }
})

// Reorder categories in single round-trip batch
app.put('/api/categories/reorder', async (c) => {
  try {
    const body = await c.req.json<{ items: Array<{ id: number; sort_order: number }> }>()
    if (!body.items || !Array.isArray(body.items)) {
      return c.json({ error: 'Invalid reorder items' }, 400)
    }

    const statements = body.items.map((item) =>
      c.env.DB.prepare('UPDATE categories SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(
        item.sort_order,
        item.id
      )
    )

    if (statements.length > 0) {
      await c.env.DB.batch(statements)
    }

    return c.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '更新分类排序失败', details: message }, 500)
  }
})

// ==========================================
// 6. Bookmark Management Endpoints
// ==========================================
app.post('/api/bookmarks', async (c) => {
  try {
    const body = await c.req.json<{
      category_id: number
      title: string
      url: string
      remark?: string
      custom_icon_url?: string
      ai_prompt?: string
    }>()

    if (!body.category_id || !body.title?.trim() || !body.url?.trim()) {
      return c.json({ error: '分类、标题和网址不能为空' }, 400)
    }

    let url = body.url.trim()
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url
    }

    const title = body.title.trim()
    const remark = body.remark?.trim() || ''
    const customIconUrl = body.custom_icon_url?.trim() || ''
    const aiPrompt = body.ai_prompt?.trim() || ''

    // Get max sort_order in this category
    const maxRow = await c.env.DB
      .prepare('SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM bookmarks WHERE category_id = ?')
      .bind(body.category_id)
      .first<{ max_sort: number }>()
    const nextSort = (maxRow?.max_sort ?? -1) + 1

    const result = await c.env.DB
      .prepare(
        'INSERT INTO bookmarks (category_id, title, url, remark, custom_icon_url, sort_order, ai_prompt) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
      )
      .bind(body.category_id, title, url, remark, customIconUrl, nextSort, aiPrompt)
      .first()

    return c.json(result, 201)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '创建书签失败', details: message }, 500)
  }
})

app.put('/api/bookmarks/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid ID' }, 400)

  try {
    const body = await c.req.json<{
      category_id?: number
      title?: string
      url?: string
      remark?: string
      custom_icon_url?: string
      ai_prompt?: string
    }>()

    let url = body.url?.trim()
    if (url && !/^https?:\/\//i.test(url)) {
      url = 'https://' + url
    }

    const updated = await c.env.DB
      .prepare(
        `UPDATE bookmarks SET 
          category_id = COALESCE(?, category_id),
          title = COALESCE(?, title),
          url = COALESCE(?, url),
          remark = COALESCE(?, remark),
          custom_icon_url = COALESCE(?, custom_icon_url),
          ai_prompt = COALESCE(?, ai_prompt),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? RETURNING *`
      )
      .bind(
        body.category_id ?? null,
        body.title?.trim() ?? null,
        url ?? null,
        body.remark !== undefined ? body.remark.trim() : null,
        body.custom_icon_url !== undefined ? body.custom_icon_url.trim() : null,
        body.ai_prompt !== undefined ? body.ai_prompt.trim() : null,
        id
      )
      .first()

    if (!updated) {
      return c.json({ error: '书签不存在' }, 404)
    }

    return c.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '更新书签失败', details: message }, 500)
  }
})

app.delete('/api/bookmarks/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid ID' }, 400)

  try {
    await c.env.DB.prepare('DELETE FROM bookmarks WHERE id = ?').bind(id).run()
    return c.json({ success: true, id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '删除书签失败', details: message }, 500)
  }
})

// Reorder bookmarks across or within categories in single batch
app.put('/api/bookmarks/reorder', async (c) => {
  try {
    const body = await c.req.json<{
      items: Array<{ id: number; category_id: number; sort_order: number }>
    }>()

    if (!body.items || !Array.isArray(body.items)) {
      return c.json({ error: 'Invalid reorder items' }, 400)
    }

    const statements = body.items.map((item) =>
      c.env.DB.prepare(
        'UPDATE bookmarks SET category_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(item.category_id, item.sort_order, item.id)
    )

    if (statements.length > 0) {
      await c.env.DB.batch(statements)
    }

    return c.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '更新书签排序失败', details: message }, 500)
  }
})

// ==========================================
// 7. Bulk Import Endpoint
// ==========================================
app.post('/api/import', async (c) => {
  try {
    const body = await c.req.json<{
      global_agent_prompt?: string
      categories: Array<{
        name: string
        icon?: string
        sort_order?: number
        is_public?: number
        share_slug?: string | null
        share_description?: string
        ai_prompt?: string
      }>
      bookmarks: Array<{
        category_name?: string
        category_index?: number
        category_id?: number
        title: string
        url: string
        remark?: string
        custom_icon_url?: string
        sort_order?: number
        ai_prompt?: string
      }>
    }>()

    if (!body.categories || !Array.isArray(body.categories)) {
      return c.json({ error: '导入数据格式错误: 缺少 categories' }, 400)
    }

    // Optionally update global_agent_prompt if provided
    if (body.global_agent_prompt && body.global_agent_prompt.trim()) {
      await c.env.DB
        .prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES ('global_agent_prompt', ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
        )
        .bind(body.global_agent_prompt.trim())
        .run()
    }

    // Insert categories and maintain map
    const catMap = new Map<string, number>()
    const catIndexMap = new Map<number, number>()

    for (let i = 0; i < body.categories.length; i++) {
      const cat = body.categories[i]
      const inserted = await c.env.DB
        .prepare(
          'INSERT INTO categories (name, icon, sort_order, is_public, share_slug, share_description, ai_prompt) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id'
        )
        .bind(
          cat.name,
          cat.icon || 'Folder',
          cat.sort_order ?? i,
          cat.is_public ?? 0,
          cat.share_slug || null,
          cat.share_description || '',
          cat.ai_prompt || ''
        )
        .first<{ id: number }>()

      if (inserted) {
        catMap.set(cat.name, inserted.id)
        catIndexMap.set(i, inserted.id)
      }
    }

    // Insert bookmarks in batch
    if (body.bookmarks && Array.isArray(body.bookmarks)) {
      const bmStatements = []
      for (let j = 0; j < body.bookmarks.length; j++) {
        const bm = body.bookmarks[j]
        let targetCatId: number | undefined

        if (bm.category_name && catMap.has(bm.category_name)) {
          targetCatId = catMap.get(bm.category_name)
        } else if (bm.category_index !== undefined && catIndexMap.has(bm.category_index)) {
          targetCatId = catIndexMap.get(bm.category_index)
        } else if (bm.category_id) {
          targetCatId = bm.category_id
        }

        if (!targetCatId) {
          // Fallback to first created category
          targetCatId = catIndexMap.get(0)
        }

        if (targetCatId && bm.title && bm.url) {
          bmStatements.push(
            c.env.DB.prepare(
              'INSERT INTO bookmarks (category_id, title, url, remark, custom_icon_url, sort_order, ai_prompt) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).bind(
              targetCatId,
              bm.title,
              bm.url,
              bm.remark || '',
              bm.custom_icon_url || '',
              bm.sort_order ?? j,
              bm.ai_prompt || ''
            )
          )
        }
      }

      if (bmStatements.length > 0) {
        await c.env.DB.batch(bmStatements)
      }
    }

    return c.json({ success: true, message: '数据导入成功' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: '数据导入失败', details: message }, 500)
  }
})

// ==========================================
// 8. Native Stateless Streamable HTTP MCP Server & LLMS Context
// ==========================================

// MCP Server Health & Info
app.get('/api/mcp', async (c) => {
  const authorized = await validateMcpAuth(c.req.raw, c.env)
  if (!authorized) {
    return c.json({ error: 'Unauthorized: Missing or invalid MCP Token' }, 401)
  }
  return c.json({
    status: 'ok',
    server: 'iTab-MCP-Server',
    version: '1.0.0',
    transport: 'Stateless Streamable HTTP (JSON-RPC 2.0)',
    endpoint: '/api/mcp',
  })
})

// MCP Server JSON-RPC 2.0 Handler
app.post('/api/mcp', async (c) => {
  const authorized = await validateMcpAuth(c.req.raw, c.env)
  if (!authorized) {
    return c.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'Unauthorized: Invalid or missing MCP Access Token',
        },
      },
      401
    )
  }

  try {
    const body = await c.req.json<Record<string, unknown>>()
    const res = await handleMcpJsonRpc(body, c.env)
    if (res.status === 204 || !res.body) {
      return c.body(null, 204)
    }
    return c.json(res.body, res.status as any)
  } catch {
    return c.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error: Invalid JSON',
        },
      },
      400
    )
  }
})

// Private Full LLMS.txt Context Document
app.get('/api/llms.txt', async (c) => {
  const authorized = await validateMcpAuth(c.req.raw, c.env)
  if (!authorized) {
    return c.text('Unauthorized: Valid token parameter or Authorization header required', 401)
  }

  try {
    const host = c.req.header('host') || 'itab.local'
    const markdown = await generatePrivateLlmsTxt(c.env.DB, host)
    c.header('Content-Type', 'text/plain; charset=utf-8')
    c.header('Cache-Control', 'private, no-cache')
    return c.text(markdown)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.text(`Failed to generate llms.txt: ${message}`, 500)
  }
})

// ==========================================
// 9. Static Assets Fallback (Cloudflare Workers)
// ==========================================
app.get('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw)
  }
  return c.text('iTab API Server Running')
})

export default app

