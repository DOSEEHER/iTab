import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Category, Bookmark, BootstrapData, ScrapedMeta, BackupPayload } from '@/types'
import { useAuthStore } from './auth'

export const useBookmarkStore = defineStore('bookmarks', () => {
  const authStore = useAuthStore()

  const categories = ref<Category[]>([])
  const bookmarks = ref<Bookmark[]>([])
  const globalAgentPrompt = ref<string>('')
  const mcpToken = ref<string | null>(null)
  const isLoading = ref<boolean>(false)
  const searchQuery = ref<string>('')
  const activeCategoryId = ref<number | null>(null) // null = all

  // Map of category_id -> bookmarks
  const bookmarksByCategory = computed(() => {
    const map = new Map<number, Bookmark[]>()
    for (const cat of categories.value) {
      map.set(cat.id, [])
    }
    for (const bm of bookmarks.value) {
      const list = map.get(bm.category_id)
      if (list) {
        list.push(bm)
      }
    }
    // Sort each group
    for (const [, list] of map) {
      list.sort((a, b) => a.sort_order - b.sort_order)
    }
    return map
  })

  // Filtered categories and bookmarks according to search query
  const filteredSections = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()

    return categories.value
      .filter((cat) => {
        if (activeCategoryId.value !== null && cat.id !== activeCategoryId.value) {
          return false
        }
        return true
      })
      .map((cat) => {
        const catBookmarks = bookmarksByCategory.value.get(cat.id) || []
        const filtered = q
          ? catBookmarks.filter(
              (bm) =>
                bm.title.toLowerCase().includes(q) ||
                bm.url.toLowerCase().includes(q) ||
                bm.remark.toLowerCase().includes(q) ||
                (bm.ai_prompt && bm.ai_prompt.toLowerCase().includes(q))
            )
          : catBookmarks
        return {
          category: cat,
          bookmarks: filtered,
        }
      })
      .filter((section) => {
        if (!q) return true
        // If searching, only show categories that match search or have matching bookmarks
        return (
          section.bookmarks.length > 0 ||
          section.category.name.toLowerCase().includes(q) ||
          (section.category.ai_prompt && section.category.ai_prompt.toLowerCase().includes(q))
        )
      })
  })

  const totalBookmarksCount = computed(() => bookmarks.value.length)

  // 1. Fetch all data in one round-trip
  const fetchBootstrap = async () => {
    isLoading.value = true
    try {
      const res = await fetch('/api/bootstrap', {
        headers: authStore.getAuthHeaders(),
      })
      if (res.status === 401) {
        authStore.logout()
        return
      }
      if (!res.ok) throw new Error('Failed to load bootstrap data')

      const data = await res.json<BootstrapData>()
      categories.value = data.categories || []
      bookmarks.value = data.bookmarks || []
      globalAgentPrompt.value = data.global_agent_prompt || ''
      mcpToken.value = data.mcp_token || null
    } catch (err) {
      console.error('[Apple] fetchBootstrap error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 2. Global AI Prompt Actions
  const updateGlobalAgentPrompt = async (newPrompt: string) => {
    const res = await fetch('/api/config/ai', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authStore.getAuthHeaders(),
      },
      body: JSON.stringify({ global_agent_prompt: newPrompt }),
    })
    if (!res.ok) throw new Error('保存全局提示词失败')
    const data = await res.json<{ success: boolean; global_agent_prompt: string }>()
    globalAgentPrompt.value = data.global_agent_prompt
    return data.global_agent_prompt
  }

  // 3. Category Actions
  const createCategory = async (name: string, icon = 'Folder', ai_prompt = '') => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authStore.getAuthHeaders(),
      },
      body: JSON.stringify({ name, icon, ai_prompt }),
    })
    if (!res.ok) throw new Error('创建分类失败')
    const created = await res.json<Category>()
    categories.value.push(created)
    return created
  }

  const updateCategory = async (
    id: number,
    name: string,
    icon?: string,
    ai_prompt?: string
  ) => {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authStore.getAuthHeaders(),
      },
      body: JSON.stringify({ name, icon, ai_prompt }),
    })
    if (!res.ok) throw new Error('更新分类失败')
    const updated = await res.json<Category>()
    const idx = categories.value.findIndex((c) => c.id === id)
    if (idx !== -1) {
      categories.value[idx] = updated
    }
    return updated
  }

  const deleteCategory = async (id: number) => {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'DELETE',
      headers: authStore.getAuthHeaders(),
    })
    if (!res.ok) throw new Error('删除分类失败')

    categories.value = categories.value.filter((c) => c.id !== id)
    bookmarks.value = bookmarks.value.filter((b) => b.category_id !== id)
    if (activeCategoryId.value === id) {
      activeCategoryId.value = null
    }
  }

  const updateShareSettings = async (
    id: number,
    settings: {
      is_public: boolean
      share_slug?: string | null
      share_description?: string
    }
  ) => {
    const res = await fetch(`/api/categories/${id}/share`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authStore.getAuthHeaders(),
      },
      body: JSON.stringify(settings),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error || '更新分享设置失败')
    }
    const updated = await res.json<Category>()
    const idx = categories.value.findIndex((c) => c.id === id)
    if (idx !== -1) {
      categories.value[idx] = updated
    }
    return updated
  }

  const reorderCategories = async (newOrder: Category[]) => {
    categories.value = [...newOrder]
    const items = newOrder.map((cat, index) => ({
      id: cat.id,
      sort_order: index,
    }))

    try {
      await fetch('/api/categories/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authStore.getAuthHeaders(),
        },
        body: JSON.stringify({ items }),
      })
    } catch (err) {
      console.error('[Apple] reorderCategories error:', err)
    }
  }

  // 4. Bookmark Actions
  const createBookmark = async (payload: {
    category_id: number
    title: string
    url: string
    remark?: string
    custom_icon_url?: string
    ai_prompt?: string
  }) => {
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authStore.getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('创建书签失败')
    const created = await res.json<Bookmark>()
    bookmarks.value.push(created)
    return created
  }

  const updateBookmark = async (
    id: number,
    payload: {
      category_id?: number
      title?: string
      url?: string
      remark?: string
      custom_icon_url?: string
      ai_prompt?: string
    }
  ) => {
    const res = await fetch(`/api/bookmarks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authStore.getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('更新书签失败')
    const updated = await res.json<Bookmark>()
    const idx = bookmarks.value.findIndex((b) => b.id === id)
    if (idx !== -1) {
      bookmarks.value[idx] = updated
    }
    return updated
  }

  const deleteBookmark = async (id: number) => {
    const res = await fetch(`/api/bookmarks/${id}`, {
      method: 'DELETE',
      headers: authStore.getAuthHeaders(),
    })
    if (!res.ok) throw new Error('删除书签失败')
    bookmarks.value = bookmarks.value.filter((b) => b.id !== id)
  }

  const reorderBookmarks = async (
    items: Array<{ id: number; category_id: number; sort_order: number }>
  ) => {
    // Optimistically update local array
    for (const item of items) {
      const bm = bookmarks.value.find((b) => b.id === item.id)
      if (bm) {
        bm.category_id = item.category_id
        bm.sort_order = item.sort_order
      }
    }

    try {
      await fetch('/api/bookmarks/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authStore.getAuthHeaders(),
        },
        body: JSON.stringify({ items }),
      })
    } catch (err) {
      console.error('[Apple] reorderBookmarks error:', err)
    }
  }

  // 5. Metadata Fetcher
  const scrapeMetadata = async (targetUrl: string): Promise<ScrapedMeta> => {
    const res = await fetch(`/api/meta?url=${encodeURIComponent(targetUrl)}`)
    if (!res.ok) throw new Error('无法解析网页元数据')
    return res.json<ScrapedMeta>()
  }

  // 6. Backup & Import
  const exportBackup = () => {
    const backup: BackupPayload = {
      version: '1.1',
      exported_at: new Date().toISOString(),
      global_agent_prompt: globalAgentPrompt.value,
      categories: categories.value,
      bookmarks: bookmarks.value,
    }

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2))
    const downloadAnchor = document.createElement('a')
    const today = new Date().toISOString().split('T')[0]
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `itab-backup-${today}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const importBackup = async (payload: {
    global_agent_prompt?: string
    categories: Category[]
    bookmarks: Bookmark[]
  }) => {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authStore.getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error || '导入备份失败')
    }
    await fetchBootstrap()
  }

  return {
    categories,
    bookmarks,
    globalAgentPrompt,
    mcpToken,
    isLoading,
    searchQuery,
    activeCategoryId,
    bookmarksByCategory,
    filteredSections,
    totalBookmarksCount,
    fetchBootstrap,
    updateGlobalAgentPrompt,
    createCategory,
    updateCategory,
    deleteCategory,
    updateShareSettings,
    reorderCategories,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    reorderBookmarks,
    scrapeMetadata,
    exportBackup,
    importBackup,
  }
})

