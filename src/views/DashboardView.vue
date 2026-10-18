<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, useTemplateRef } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBookmarkStore } from '@/stores/bookmarks'
import { useDark, useToggle, useStorage } from '@vueuse/core'
import type { Category, Bookmark } from '@/types'
import { VueDraggable } from 'vue-draggable-plus'

import BookmarkCard from '@/components/BookmarkCard.vue'
import BookmarkModal from '@/components/BookmarkModal.vue'
import CategoryModal from '@/components/CategoryModal.vue'
import CategoryShareModal from '@/components/CategoryShareModal.vue'
import BackupModal from '@/components/BackupModal.vue'
import AiAgentConsoleModal from '@/components/AiAgentConsoleModal.vue'

import {
  SquareBookmark as BookmarkBrandIcon,
  Bookmark as CategoryBookmarkIcon,
  Search,
  Plus,
  FolderPlus,
  Share2,
  Edit2,
  Trash2,
  GripVertical,
  Sun,
  Moon,
  LogOut,
  Database,
  ShieldAlert,
  Loader2,
  Layers,
  Folder,
  Sparkles,
  Bot,
  Code2,
  Palette,
  Globe,
  Terminal,
  BookOpen,
  Cpu,
  Compass,
  Briefcase,
  Star,
  Heart,
  Smile,
  Flame,
  Zap,
  Coffee,
  Music,
  Gamepad2,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from '@lucide/vue'

const authStore = useAuthStore()
const bookmarkStore = useBookmarkStore()

const isDark = useDark({ storageKey: 'itab-theme' })
const toggleDark = useToggle(isDark)
const isSidebarCollapsed = useStorage('itab-sidebar-collapsed', false)

const searchInput = useTemplateRef<HTMLInputElement>('search-input')
const isMobileSidebarOpen = ref(false)

// Modals State
const isBookmarkModalOpen = ref(false)
const bookmarkToEdit = ref<Bookmark | null>(null)
const initialCategoryId = ref<number | null>(null)

const isCategoryModalOpen = ref(false)
const categoryToEdit = ref<Category | null>(null)

const isShareModalOpen = ref(false)
const categoryToShare = ref<Category | null>(null)

const isBackupModalOpen = ref(false)
const isAiConsoleModalOpen = ref(false)

// Icon mapper for categories
const iconMap: Record<string, unknown> = {
  Folder,
  Sparkles,
  Code2,
  Palette,
  Globe,
  Terminal,
  BookOpen,
  Cpu,
  Layers,
  Compass,
  Briefcase,
  Bookmark: CategoryBookmarkIcon,
  SquareBookmark: BookmarkBrandIcon,
  Star,
  Heart,
  Smile,
  Flame,
  Zap,
  Coffee,
  Music,
  Gamepad2,
}

const getCategoryIconComponent = (iconName?: string) => {
  if (!iconName) return Folder
  return iconMap[iconName] || Folder
}

// Draggable local categories copy
const draggableCategories = computed({
  get: () => bookmarkStore.categories,
  set: (val: Category[]) => {
    bookmarkStore.reorderCategories(val)
  },
})

// Shortcut key listener (Cmd+K or /)
const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    searchInput.value?.focus()
  } else if (
    e.key === '/' &&
    document.activeElement?.tagName !== 'INPUT' &&
    document.activeElement?.tagName !== 'TEXTAREA'
  ) {
    e.preventDefault()
    searchInput.value?.focus()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  try {
    await bookmarkStore.fetchBootstrap()
  } catch (err) {
    console.error('[Apple] Bootstrap failed:', err)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Category Actions
const handleOpenCreateCategory = () => {
  categoryToEdit.value = null
  isCategoryModalOpen.value = true
  isMobileSidebarOpen.value = false
}

const handleOpenEditCategory = (cat: Category) => {
  categoryToEdit.value = cat
  isCategoryModalOpen.value = true
}

const handleSaveCategory = async (payload: { name: string; icon: string; ai_prompt?: string }) => {
  try {
    if (categoryToEdit.value) {
      await bookmarkStore.updateCategory(
        categoryToEdit.value.id,
        payload.name,
        payload.icon,
        payload.ai_prompt
      )
    } else {
      await bookmarkStore.createCategory(payload.name, payload.icon, payload.ai_prompt)
    }
    isCategoryModalOpen.value = false
  } catch (err) {
    alert(err instanceof Error ? err.message : '保存分类失败')
  }
}

const handleDeleteCategory = async (cat: Category) => {
  const count = bookmarkStore.bookmarksByCategory.get(cat.id)?.length || 0
  const confirmMsg = count > 0
    ? `确定要删除分类【${cat.name}】吗？该分类下的 ${count} 个书签将一并删除！`
    : `确定要删除分类【${cat.name}】吗？`
  if (!confirm(confirmMsg)) return

  try {
    await bookmarkStore.deleteCategory(cat.id)
  } catch (err) {
    alert(err instanceof Error ? err.message : '删除分类失败')
  }
}

const handleOpenShareModal = (cat: Category) => {
  categoryToShare.value = cat
  isShareModalOpen.value = true
}

const handleSaveShare = async (payload: {
  id: number
  is_public: boolean
  share_slug: string | null
  share_description: string
}) => {
  try {
    await bookmarkStore.updateShareSettings(payload.id, {
      is_public: payload.is_public,
      share_slug: payload.share_slug,
      share_description: payload.share_description,
    })
    isShareModalOpen.value = false
  } catch (err) {
    alert(err instanceof Error ? err.message : '保存分享失败')
  }
}

// Bookmark Actions
const handleOpenAddBookmark = (catId?: number) => {
  bookmarkToEdit.value = null
  initialCategoryId.value = catId || bookmarkStore.activeCategoryId || bookmarkStore.categories[0]?.id || 1
  isBookmarkModalOpen.value = true
}

const handleOpenEditBookmark = (bm: Bookmark) => {
  bookmarkToEdit.value = bm
  initialCategoryId.value = bm.category_id
  isBookmarkModalOpen.value = true
}

const handleSaveBookmark = async (payload: {
  category_id: number
  title: string
  url: string
  remark: string
  custom_icon_url: string
  ai_prompt?: string
}) => {
  try {
    if (bookmarkToEdit.value) {
      await bookmarkStore.updateBookmark(bookmarkToEdit.value.id, payload)
    } else {
      await bookmarkStore.createBookmark(payload)
    }
    isBookmarkModalOpen.value = false
  } catch (err) {
    alert(err instanceof Error ? err.message : '保存书签失败')
  }
}

const handleDeleteBookmark = async (bm: Bookmark) => {
  if (!confirm(`确定要删除书签【${bm.title}】吗？`)) return
  try {
    await bookmarkStore.deleteBookmark(bm.id)
  } catch (err) {
    alert(err instanceof Error ? err.message : '删除书签失败')
  }
}

// Drag & Drop reorder handlers
const handleBookmarkDrop = (targetCategoryId: number) => {
  const targetCategoryBookmarks = bookmarkStore.bookmarksByCategory.get(targetCategoryId) || []
  const items = targetCategoryBookmarks.map((bm, index) => ({
    id: bm.id,
    category_id: targetCategoryId,
    sort_order: index,
  }))
  if (items.length > 0) {
    bookmarkStore.reorderBookmarks(items)
  }
}

const handleCategoryClick = (catId: number | null) => {
  bookmarkStore.activeCategoryId = catId
  isMobileSidebarOpen.value = false
}
</script>

<template>
  <div class="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden transition-colors">
    <!-- Top Sticky Header -->
    <header class="h-14 shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 z-20 flex items-center justify-between px-3 sm:px-6">
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Mobile Sidebar Toggle -->
        <button
          type="button"
          class="lg:hidden p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="isMobileSidebarOpen = !isMobileSidebarOpen"
        >
          <Menu class="w-5 h-5" />
        </button>

        <!-- Brand Logo & Sidebar Toggle (Hidden on mobile < sm, visible on desktop) -->
        <div class="hidden sm:flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <BookmarkBrandIcon class="w-4 h-4" />
          </div>
          <span class="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
            iTab
          </span>

          <!-- Desktop Sidebar Toggle Button beside Logo -->
          <button
            type="button"
            :title="isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
            class="hidden lg:flex p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            @click="isSidebarCollapsed = !isSidebarCollapsed"
          >
            <PanelLeftOpen v-if="isSidebarCollapsed" class="w-4 h-4" />
            <PanelLeftClose v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Global Search Bar (Maximized on mobile) -->
      <div class="flex-1 max-w-lg mx-2 sm:mx-4">
        <div class="relative flex items-center">
          <Search class="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
          <input
            ref="search-input"
            v-model="bookmarkStore.searchQuery"
            type="text"
            placeholder="搜索书签标题、描述或网址..."
            class="w-full pl-9 pr-3 sm:pr-14 py-1.5 text-xs rounded-xl bg-zinc-100/90 dark:bg-zinc-800/90 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none transition-all"
          />
          <kbd class="hidden sm:inline-flex items-center gap-0.5 absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
            ⌘K
          </kbd>
        </div>
      </div>

      <!-- Right Header Tools -->
      <div class="flex items-center gap-1 sm:gap-2">
        <!-- Temporary Session Banner Pill -->
        <div
          v-if="authStore.isTemporary"
          class="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs"
        >
          <ShieldAlert class="w-3.5 h-3.5" />
          <span class="font-mono font-medium">临时登录 · {{ authStore.countdownFormatted }}</span>
          <button
            type="button"
            title="立即销毁并退出"
            class="ml-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 underline cursor-pointer"
            @click="authStore.logout()"
          >
            销毁退出
          </button>
        </div>

        <!-- AI / MCP Console Button (Hidden on mobile) -->
        <button
          type="button"
          title="AI Agent / MCP 控制台"
          class="hidden sm:flex px-2.5 py-1.5 rounded-xl text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/60 active:scale-[0.98] transition-all items-center gap-1.5 shadow-xs cursor-pointer"
          @click="isAiConsoleModalOpen = true"
        >
          <Bot class="w-3.5 h-3.5 text-purple-500" />
          <span class="hidden sm:inline">AI / MCP</span>
        </button>

        <!-- + Add Bookmark Button -->
        <button
          type="button"
          title="添加网址"
          class="p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          @click="handleOpenAddBookmark()"
        >
          <Plus class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">添加网址</span>
        </button>

        <!-- Backup & Restore Button (Hidden on mobile) -->
        <button
          type="button"
          title="数据备份与恢复"
          class="hidden sm:flex p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          @click="isBackupModalOpen = true"
        >
          <Database class="w-4 h-4" />
        </button>

        <!-- Theme Toggle -->
        <button
          type="button"
          title="切换深色/浅色模式"
          class="p-1.5 sm:p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          @click="toggleDark()"
        >
          <Sun v-if="isDark" class="w-4 h-4" />
          <Moon v-else class="w-4 h-4" />
        </button>

        <!-- Logout -->
        <button
          type="button"
          title="退出登录"
          class="p-1.5 sm:p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          @click="authStore.logout()"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- Mobile Temporary Banner (if active) -->
    <div
      v-if="authStore.isTemporary"
      class="md:hidden bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400"
    >
      <div class="flex items-center gap-1.5">
        <ShieldAlert class="w-3.5 h-3.5" />
        <span class="font-mono">临时登录 · {{ authStore.countdownFormatted }}</span>
      </div>
      <button
        type="button"
        class="text-rose-500 font-medium underline"
        @click="authStore.logout()"
      >
        立即销毁
      </button>
    </div>

    <!-- Mobile Horizontal Category Pill Bar -->
    <div class="lg:hidden shrink-0 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <button
        type="button"
        class="shrink-0 px-3 py-1 rounded-xl text-xs font-medium transition-all"
        :class="
          bookmarkStore.activeCategoryId === null
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
        "
        @click="handleCategoryClick(null)"
      >
        全部 ({{ bookmarkStore.totalBookmarksCount }})
      </button>

      <button
        v-for="cat in bookmarkStore.categories"
        :key="cat.id"
        type="button"
        class="shrink-0 px-3 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
        :class="
          bookmarkStore.activeCategoryId === cat.id
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
        "
        @click="handleCategoryClick(cat.id)"
      >
        <component :is="getCategoryIconComponent(cat.icon)" class="w-3.5 h-3.5" />
        <span>{{ cat.name }}</span>
        <span
          v-if="cat.is_public"
          class="w-1.5 h-1.5 rounded-full bg-emerald-500"
        ></span>
      </button>

      <button
        type="button"
        class="shrink-0 p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-blue-500"
        @click="handleOpenCreateCategory"
      >
        <Plus class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Main Workspace (Sidebar + Content Grid) -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Desktop Sidebar (240px or 64px) -->
      <aside
        class="hidden lg:flex flex-col shrink-0 bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md border-r border-zinc-200/80 dark:border-zinc-800/80 select-none transition-all duration-300 ease-in-out"
        :class="isSidebarCollapsed ? 'w-16 px-2 py-3' : 'w-60 p-3'"
      >
        <!-- Category Navigation Menu -->
        <div class="flex-1 overflow-y-auto space-y-1 w-full" :class="isSidebarCollapsed ? 'no-scrollbar' : 'pr-1'">
          <!-- All Categories Tab -->
          <button
            type="button"
            class="w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer"
            :class="[
              isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2',
              bookmarkStore.activeCategoryId === null
                ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            ]"
            :title="isSidebarCollapsed ? `全部书签 (${bookmarkStore.totalBookmarksCount})` : undefined"
            @click="bookmarkStore.activeCategoryId = null"
          >
            <div class="flex items-center gap-2.5 truncate" :class="{ 'justify-center': isSidebarCollapsed }">
              <Layers class="w-4 h-4 text-zinc-500 shrink-0" />
              <span v-if="!isSidebarCollapsed">全部书签</span>
            </div>
            <span
              v-if="!isSidebarCollapsed"
              class="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500"
            >
              {{ bookmarkStore.totalBookmarksCount }}
            </span>
          </button>

          <!-- Divider -->
          <div class="py-2">
            <div class="h-px bg-zinc-200/60 dark:border-zinc-800/60"></div>
          </div>

          <!-- Draggable Category List -->
          <VueDraggable
            v-model="draggableCategories"
            :animation="150"
            :disabled="isSidebarCollapsed"
            handle=".category-drag-handle"
            class="space-y-1"
          >
            <div
              v-for="cat in draggableCategories"
              :key="cat.id"
              class="group relative flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer"
              :class="[
                isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2',
                bookmarkStore.activeCategoryId === cat.id
                  ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              ]"
              :title="isSidebarCollapsed ? `${cat.name} (${bookmarkStore.bookmarksByCategory.get(cat.id)?.length || 0})` : undefined"
              @click="bookmarkStore.activeCategoryId = cat.id"
            >
              <div class="flex items-center gap-2.5 truncate" :class="{ 'justify-center': isSidebarCollapsed }">
                <!-- Drag Handle -->
                <span
                  v-if="!isSidebarCollapsed"
                  class="category-drag-handle p-0.5 -ml-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
                  @click.stop
                >
                  <GripVertical class="w-3.5 h-3.5" />
                </span>

                <component :is="getCategoryIconComponent(cat.icon)" class="w-4 h-4 shrink-0 text-zinc-500 group-hover:text-blue-500 transition-colors" />

                <span v-if="!isSidebarCollapsed" class="truncate">{{ cat.name }}</span>
              </div>

              <div v-if="!isSidebarCollapsed" class="flex items-center gap-1.5 shrink-0">
                <span class="text-[11px] font-mono text-zinc-400 group-hover:hidden">
                  {{ bookmarkStore.bookmarksByCategory.get(cat.id)?.length || 0 }}
                </span>

                <!-- Quick actions on hover in sidebar -->
                <div class="hidden group-hover:flex items-center gap-0.5">
                  <button
                    type="button"
                    title="公开分享设置"
                    class="p-1 rounded text-zinc-400 hover:text-emerald-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                    @click.stop="handleOpenShareModal(cat)"
                  >
                    <Share2 class="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    title="编辑分类"
                    class="p-1 rounded text-zinc-400 hover:text-blue-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                    @click.stop="handleOpenEditCategory(cat)"
                  >
                    <Edit2 class="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    title="删除分类"
                    class="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                    @click.stop="handleDeleteCategory(cat)"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </VueDraggable>
        </div>

        <!-- Sidebar Footer: + New Category -->
        <div class="pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 w-full flex justify-center">
          <button
            type="button"
            class="flex items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all cursor-pointer"
            :class="isSidebarCollapsed ? 'w-10 h-10 rounded-xl p-0' : 'w-full gap-2 py-2 px-3 rounded-xl'"
            :title="isSidebarCollapsed ? '新建分类' : undefined"
            @click="handleOpenCreateCategory"
          >
            <FolderPlus class="w-4 h-4" />
            <span v-if="!isSidebarCollapsed">新建分类</span>
          </button>
        </div>
      </aside>

      <!-- Mobile Sidebar Drawer Backdrop -->
      <div
        v-if="isMobileSidebarOpen"
        class="fixed inset-0 z-40 bg-zinc-950/50 backdrop-blur-sm lg:hidden"
        @click="isMobileSidebarOpen = false"
      >
        <div
          class="w-72 h-full bg-white dark:bg-zinc-900 p-4 flex flex-col justify-between shadow-2xl"
          @click.stop
        >
          <div>
            <div class="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <span class="font-bold text-sm text-zinc-900 dark:text-zinc-100">分类导航</span>
              <button
                type="button"
                class="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                @click="isMobileSidebarOpen = false"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <div class="mt-4 space-y-1">
              <button
                type="button"
                class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium"
                :class="bookmarkStore.activeCategoryId === null ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'"
                @click="handleCategoryClick(null)"
              >
                <span>全部书签</span>
                <span>{{ bookmarkStore.totalBookmarksCount }}</span>
              </button>

              <div
                v-for="cat in bookmarkStore.categories"
                :key="cat.id"
                class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium"
                :class="bookmarkStore.activeCategoryId === cat.id ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'"
                @click="handleCategoryClick(cat.id)"
              >
                <div class="flex items-center gap-2">
                  <component :is="getCategoryIconComponent(cat.icon)" class="w-4 h-4" />
                  <span>{{ cat.name }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="p-1 text-zinc-400 hover:text-emerald-500"
                    @click.stop="handleOpenShareModal(cat)"
                  >
                    <Share2 class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    class="p-1 text-zinc-400 hover:text-blue-500"
                    @click.stop="handleOpenEditCategory(cat)"
                  >
                    <Edit2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <button
              type="button"
              class="w-full py-2 px-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-medium flex items-center justify-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-blue-600"
              @click="handleOpenCreateCategory"
            >
              <FolderPlus class="w-4 h-4" />
              <span>新建分类</span>
            </button>

            <!-- Mobile Secondary Access to AI & Backup -->
            <div class="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                class="flex-1 py-1.5 px-2 rounded-xl text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-center gap-1.5 cursor-pointer"
                @click="isAiConsoleModalOpen = true; isMobileSidebarOpen = false"
              >
                <Bot class="w-3.5 h-3.5 text-purple-500" />
                <span>AI 控制台</span>
              </button>
              <button
                type="button"
                class="flex-1 py-1.5 px-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center gap-1.5 cursor-pointer"
                @click="isBackupModalOpen = true; isMobileSidebarOpen = false"
              >
                <Database class="w-3.5 h-3.5" />
                <span>数据备份</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Grid Area -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <!-- Loading State -->
        <div v-if="bookmarkStore.isLoading" class="flex flex-col items-center justify-center py-24 text-zinc-400">
          <Loader2 class="w-8 h-8 animate-spin mb-3 text-blue-500" />
          <p class="text-xs">正在连接 Edge SQLite (Cloudflare D1)...</p>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="bookmarkStore.categories.length === 0"
          class="max-w-md mx-auto text-center py-20 px-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm"
        >
          <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
            <FolderPlus class="w-6 h-6" />
          </div>
          <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            暂无书签分类
          </h2>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
            点击下方按钮创建您的第一个书签分类，开启高效的网址导航体验。
          </p>
          <button
            type="button"
            class="mt-6 px-4 py-2 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-xs"
            @click="handleOpenCreateCategory"
          >
            新建分类
          </button>
        </div>

        <!-- Category Sections -->
        <div v-else class="space-y-8 max-w-[1920px] w-full mx-auto">
          <section
            v-for="section in bookmarkStore.filteredSections"
            :key="section.category.id"
            class="space-y-3"
          >
            <!-- Category Section Header -->
            <div class="flex items-center justify-between pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
              <div class="flex items-center gap-2.5">
                <div class="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <component :is="getCategoryIconComponent(section.category.icon)" class="w-4 h-4" />
                </div>
                <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  {{ section.category.name }}
                  <span class="text-xs font-normal text-zinc-400">
                    ({{ section.bookmarks.length }})
                  </span>
                </h2>

                <!-- Public Badge Link -->
                <router-link
                  v-if="section.category.is_public"
                  :to="`/${section.category.share_slug}`"
                  target="_blank"
                  title="在新标签页预览公开分享页面"
                  class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <Globe class="w-4 h-4" />
                </router-link>
              </div>

              <!-- Category Action Buttons -->
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  title="公开分享设置"
                  class="px-2 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
                  @click="handleOpenShareModal(section.category)"
                >
                  <Share2 class="w-3.5 h-3.5" />
                  <span class="hidden sm:inline">公开分享</span>
                </button>

                <button
                  type="button"
                  title="在此分类添加网址"
                  class="px-2 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1"
                  @click="handleOpenAddBookmark(section.category.id)"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span class="hidden sm:inline">添加网址</span>
                </button>

                <button
                  type="button"
                  title="编辑分类"
                  class="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  @click="handleOpenEditCategory(section.category)"
                >
                  <Edit2 class="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  title="删除分类"
                  class="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  @click="handleDeleteCategory(section.category)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Bookmarks Draggable Grid -->
            <VueDraggable
              v-model="section.bookmarks"
              group="bookmarks"
              :animation="150"
              handle=".drag-handle"
              :delay="220"
              :delay-on-touch-only="true"
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 responsive-bookmark-grid gap-3.5 min-h-[50px] p-1 rounded-2xl"
              @end="handleBookmarkDrop(section.category.id)"
            >
              <BookmarkCard
                v-for="bm in section.bookmarks"
                :key="bm.id"
                :bookmark="bm"
                :category-name="section.category.name"
                :category-ai-prompt="section.category.ai_prompt || ''"
                @edit="handleOpenEditBookmark"
                @delete="handleDeleteBookmark"
              />
            </VueDraggable>

            <!-- Empty category prompt -->
            <div
              v-if="section.bookmarks.length === 0"
              class="py-6 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 flex items-center justify-center gap-2"
            >
              <span>暂无书签，</span>
              <button
                type="button"
                class="text-blue-500 hover:underline font-medium"
                @click="handleOpenAddBookmark(section.category.id)"
              >
                点击快速添加
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>

    <!-- Modals -->
    <BookmarkModal
      :is-open="isBookmarkModalOpen"
      :categories="bookmarkStore.categories"
      :initial-category-id="initialCategoryId"
      :bookmark-to-edit="bookmarkToEdit"
      @close="isBookmarkModalOpen = false"
      @save="handleSaveBookmark"
    />

    <CategoryModal
      :is-open="isCategoryModalOpen"
      :category-to-edit="categoryToEdit"
      @close="isCategoryModalOpen = false"
      @save="handleSaveCategory"
    />

    <CategoryShareModal
      :is-open="isShareModalOpen"
      :category="categoryToShare"
      @close="isShareModalOpen = false"
      @save="handleSaveShare"
    />

    <BackupModal
      :is-open="isBackupModalOpen"
      @close="isBackupModalOpen = false"
      @export="bookmarkStore.exportBackup()"
      @import="bookmarkStore.importBackup"
    />

    <AiAgentConsoleModal
      :is-open="isAiConsoleModalOpen"
      @close="isAiConsoleModalOpen = false"
    />
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

@media (min-width: 1700px) {
  .responsive-bookmark-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  }
}
</style>
