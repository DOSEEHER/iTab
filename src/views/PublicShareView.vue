<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Category, Bookmark, PublicShareData } from '@/types'
import BookmarkCard from '@/components/BookmarkCard.vue'
import { useDark, useToggle } from '@vueuse/core'
import {
  SquareBookmark as BookmarkBrandIcon,
  Search,
  Sun,
  Moon,
  FolderOpen,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
} from '@lucide/vue'

const route = useRoute()
const router = useRouter()

const isDark = useDark({ storageKey: 'itab-theme' })
const toggleDark = useToggle(isDark)

const slug = computed(() => (route.params.slug as string) || '')
const category = ref<Category | null>(null)
const bookmarks = ref<Bookmark[]>([])
const isLoading = ref(true)
const notFound = ref(false)
const localSearch = ref('')
const isCopiedLlms = ref(false)

const hasAnyAiPrompt = computed(() => {
  if (category.value?.ai_prompt && category.value.ai_prompt.trim()) return true
  return bookmarks.value.some((b) => b.ai_prompt && b.ai_prompt.trim())
})

const publicLlmsUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/public/s/${slug.value}/llms.txt`
  }
  return `/api/public/s/${slug.value}/llms.txt`
})

const copyPublicLlms = async () => {
  try {
    await navigator.clipboard.writeText(publicLlmsUrl.value)
    isCopiedLlms.value = true
    setTimeout(() => {
      isCopiedLlms.value = false
    }, 1800)
  } catch (err) {
    console.error('[Apple] Copy failed', err)
  }
}

const fetchPublicCategory = async () => {
  if (!slug.value) {
    notFound.value = true
    isLoading.value = false
    return
  }

  isLoading.value = true
  notFound.value = false

  try {
    const res = await fetch(`/api/public/s/${encodeURIComponent(slug.value)}`)
    if (res.status === 404) {
      notFound.value = true
      return
    }
    if (!res.ok) throw new Error('加载公开分享失败')

    const data = await res.json<PublicShareData>()
    category.value = data.category
    bookmarks.value = data.bookmarks || []
  } catch (err) {
    console.error('[Apple] Fetch public share error:', err)
    notFound.value = true
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchPublicCategory()
})

const filteredBookmarks = computed(() => {
  const q = localSearch.value.trim().toLowerCase()
  if (!q) return bookmarks.value
  return bookmarks.value.filter(
    (b) =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      b.remark.toLowerCase().includes(q)
  )
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors">
    <!-- Header -->
    <header class="sticky top-0 z-30 w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80">
      <div class="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <!-- Logo / Brand -->
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <BookmarkBrandIcon class="w-5 h-5" />
          </div>
          <div>
            <span class="font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              iTab
              <span class="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                公开分享
              </span>
            </span>
          </div>
        </div>

        <!-- Search Input -->
        <div class="flex-1 max-w-md mx-4 hidden sm:block">
          <div class="relative flex items-center">
            <Search class="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
            <input
              v-model="localSearch"
              type="text"
              placeholder="在当前分享中检索网址或标题..."
              class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none transition-all"
            />
          </div>
        </div>

        <!-- Right Actions: AI Context Link, Theme Toggle & Admin Login Link -->
        <div class="flex items-center gap-2">
          <!-- Copy AI Context Link (llms.txt) -->
          <button
            v-if="hasAnyAiPrompt"
            type="button"
            class="text-xs px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/80 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="复制此公开合集的 AI 读取链接"
            @click="copyPublicLlms"
          >
            <Check v-if="isCopiedLlms" class="w-3.5 h-3.5 text-emerald-500" />
            <Sparkles v-else class="w-3.5 h-3.5 text-purple-500" />
            <span>{{ isCopiedLlms ? '已复制链接' : '复制 AI 专用读取链接' }}</span>
          </button>

          <button
            type="button"
            title="切换主题"
            class="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            @click="toggleDark()"
          >
            <Sun v-if="isDark" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Mobile Search Sub-bar -->
      <div class="sm:hidden px-4 pb-3 flex flex-col gap-2">
        <div class="relative flex items-center">
          <Search class="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
          <input
            v-model="localSearch"
            type="text"
            placeholder="搜索书签..."
            class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none transition-all"
          />
        </div>

        <button
          v-if="hasAnyAiPrompt"
          type="button"
          class="w-full text-xs py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/80 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 flex items-center justify-center gap-1.5"
          @click="copyPublicLlms"
        >
          <Check v-if="isCopiedLlms" class="w-3.5 h-3.5 text-emerald-500" />
          <Sparkles v-else class="w-3.5 h-3.5 text-purple-500" />
          <span>{{ isCopiedLlms ? '已复制 AI 链接' : '复制 AI 读取链接 (llms.txt)' }}</span>
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 max-w-[1920px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 text-zinc-400">
        <Loader2 class="w-8 h-8 animate-spin mb-3 text-blue-500" />
        <p class="text-xs">正在安全加载分享书签...</p>
      </div>

      <!-- 404 / Not Found State -->
      <div
        v-else-if="notFound || !category"
        class="max-w-md mx-auto text-center py-20 px-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm"
      >
        <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
          <AlertCircle class="w-6 h-6" />
        </div>
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          分享不存在或已取消公开
        </h2>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
          该分享链接可能已被管理员重置、关闭或删除。
        </p>
        <button
          type="button"
          class="mt-6 px-4 py-2 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
          @click="router.push('/login')"
        >
          返回登录
        </button>
      </div>

      <!-- Category Content View -->
      <div v-else class="space-y-6">
        <!-- Category Banner -->
        <div class="p-6 rounded-3xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/10">
                <FolderOpen class="w-6 h-6" />
              </div>
              <div>
                <div class="flex items-center gap-2.5">
                  <h1 class="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {{ category.name }}
                  </h1>
                </div>
                <p v-if="category.share_description" class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                  {{ category.share_description }}
                </p>
              </div>
            </div>

            <!-- Stats Badge -->
            <div class="shrink-0 text-xs text-zinc-500 dark:text-zinc-400 self-start sm:self-auto bg-zinc-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl">
              共 <span class="font-semibold text-zinc-900 dark:text-zinc-100">{{ bookmarks.length }}</span> 个书签
            </div>
          </div>

          <!-- Category AI Guidelines Pill (if present) -->
          <div
            v-if="category.ai_prompt && category.ai_prompt.trim()"
            class="mt-4 p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5"
          >
            <Sparkles class="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <span class="font-semibold text-purple-700 dark:text-purple-300">分类 AI 操作指南：</span>
              <span class="font-mono ml-1">{{ category.ai_prompt }}</span>
            </div>
          </div>
        </div>

        <!-- Bookmarks Grid -->
        <div
          v-if="filteredBookmarks.length > 0"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 responsive-bookmark-grid gap-3.5"
        >
          <BookmarkCard
            v-for="bm in filteredBookmarks"
            :key="bm.id"
            :bookmark="bm"
            :category-name="category.name"
            :category-ai-prompt="category.ai_prompt || ''"
            :is-read-only="true"
          />
        </div>

        <!-- Empty search results -->
        <div
          v-else
          class="py-16 text-center text-xs text-zinc-400"
        >
          没有找到匹配的书签
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="py-6 border-t border-zinc-200/80 dark:border-zinc-800/80 text-center text-xs text-zinc-400">
      <p>Powered by iTab · Deployed on Cloudflare Edge</p>
    </footer>
  </div>
</template>

<style scoped>
@media (min-width: 1700px) {
  .responsive-bookmark-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  }
}
</style>
