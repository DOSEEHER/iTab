<script setup lang="ts">
import { ref, computed, watch, nextTick, useTemplateRef } from 'vue'
import type { Category, Bookmark } from '@/types'
import BookmarkIcon from './BookmarkIcon.vue'
import {
  X,
  Sparkles,
  Loader2,
  Folder,
  Globe,
  Tag,
  FileText,
  Image as ImageIcon,
} from '@lucide/vue'

const {
  isOpen,
  categories,
  initialCategoryId = null,
  bookmarkToEdit = null,
} = defineProps<{
  isOpen: boolean
  categories: Category[]
  initialCategoryId?: number | null
  bookmarkToEdit?: Bookmark | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'save',
    payload: {
      category_id: number
      title: string
      url: string
      remark: string
      custom_icon_url: string
      ai_prompt: string
    }
  ): void
}>()

const urlInput = useTemplateRef<HTMLInputElement>('url-input')

const categoryId = ref<number>(1)
const title = ref('')
const url = ref('')
const remark = ref('')
const customIconUrl = ref('')
const aiPrompt = ref('')
const isFetchingMeta = ref(false)
const errorMessage = ref('')

const isEditing = computed(() => Boolean(bookmarkToEdit))

watch(
  () => isOpen,
  (open) => {
    if (open) {
      errorMessage.value = ''
      if (bookmarkToEdit) {
        categoryId.value = bookmarkToEdit.category_id
        title.value = bookmarkToEdit.title
        url.value = bookmarkToEdit.url
        remark.value = bookmarkToEdit.remark || ''
        customIconUrl.value = bookmarkToEdit.custom_icon_url || ''
        aiPrompt.value = bookmarkToEdit.ai_prompt || ''
      } else {
        categoryId.value = initialCategoryId || (categories[0]?.id ?? 1)
        title.value = ''
        url.value = ''
        remark.value = ''
        customIconUrl.value = ''
        aiPrompt.value = ''
      }

      nextTick(() => {
        urlInput.value?.focus()
      })
    }
  },
  { immediate: true }
)

const handleAutoFetchMeta = async () => {
  if (!url.value.trim()) return

  isFetchingMeta.value = true
  errorMessage.value = ''

  try {
    let cleanUrl = url.value.trim()
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl
      url.value = cleanUrl
    }

    const res = await fetch(`/api/meta?url=${encodeURIComponent(cleanUrl)}`)
    if (!res.ok) throw new Error('元数据解析服务暂不可用')

    const data = await res.json<{
      title: string
      description: string
      favicon: string
    }>()

    if (data.title && !title.value) {
      title.value = data.title
    }
    if (data.description && !remark.value) {
      remark.value = data.description
    }
    if (data.favicon && !customIconUrl.value) {
      customIconUrl.value = data.favicon
    }
  } catch (err: unknown) {
    console.warn('[Apple] Auto-fetch meta notice:', err)
  } finally {
    isFetchingMeta.value = false
  }
}

const handleSubmit = () => {
  if (!url.value.trim()) {
    errorMessage.value = '请输入网址'
    return
  }
  if (!title.value.trim()) {
    errorMessage.value = '请输入书签标题'
    return
  }
  if (!categoryId.value) {
    errorMessage.value = '请选择分类'
    return
  }

  let finalUrl = url.value.trim()
  if (!/^https?:\/\//i.test(finalUrl)) {
    finalUrl = 'https://' + finalUrl
  }

  emit('save', {
    category_id: categoryId.value,
    title: title.value.trim(),
    url: finalUrl,
    remark: remark.value.trim(),
    custom_icon_url: customIconUrl.value.trim(),
    ai_prompt: aiPrompt.value.trim(),
  })
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm transition-all"
    @keydown.esc="emit('close')"
  >
    <div
      class="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Tag class="w-4 h-4 text-blue-500" />
          {{ isEditing ? '编辑书签' : '添加新书签' }}
        </h2>
        <button
          type="button"
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form Body -->
      <form class="mt-4 space-y-4" @submit.prevent="handleSubmit">
        <!-- Error Alert -->
        <div
          v-if="errorMessage"
          class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400"
        >
          {{ errorMessage }}
        </div>

        <!-- URL Input with Auto-Fetch Button -->
        <div>
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
            <Globe class="w-3.5 h-3.5 text-zinc-400" />
            网址 (URL) <span class="text-rose-500">*</span>
          </label>
          <div class="relative flex items-center">
            <input
              ref="url-input"
              v-model="url"
              type="text"
              placeholder="https://example.com"
              required
              class="w-full px-3 py-2 pr-24 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              @blur="handleAutoFetchMeta"
              @keydown.enter.prevent="handleAutoFetchMeta"
            />
            <button
              type="button"
              class="absolute right-1.5 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors disabled:opacity-50"
              :disabled="isFetchingMeta || !url.trim()"
              @click="handleAutoFetchMeta"
            >
              <Loader2 v-if="isFetchingMeta" class="w-3 h-3 animate-spin" />
              <Sparkles v-else class="w-3 h-3" />
              <span>自动解析</span>
            </button>
          </div>
          <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            输入网址后按回车或失去焦点即可自动抓取网页标题和图标
          </p>
        </div>

        <!-- Category Select -->
        <div>
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
            <Folder class="w-3.5 h-3.5 text-zinc-400" />
            所属分类 <span class="text-rose-500">*</span>
          </label>
          <select
            v-model="categoryId"
            class="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option
              v-for="cat in categories"
              :key="cat.id"
              :value="cat.id"
            >
              {{ cat.name }} {{ cat.is_public ? '(已公开)' : '' }}
            </option>
          </select>
        </div>

        <!-- Title Input & Live Preview -->
        <div>
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Tag class="w-3.5 h-3.5 text-zinc-400" />
              网站标题 <span class="text-rose-500">*</span>
            </span>
            <span class="text-[11px] text-zinc-400">实时图标预览</span>
          </label>
          <div class="flex items-center gap-3">
            <BookmarkIcon
              :url="url || 'https://itab.local'"
              :title="title || 'iTab'"
              :custom-icon-url="customIconUrl"
              :size="38"
            />
            <input
              v-model="title"
              type="text"
              placeholder="例如: GitHub"
              required
              class="flex-1 px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <!-- Remark / Description Input -->
        <div>
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
            <FileText class="w-3.5 h-3.5 text-zinc-400" />
            备注描述 (选填)
          </label>
          <textarea
            v-model="remark"
            rows="2"
            placeholder="自定义简短说明或备忘..."
            class="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
          ></textarea>
        </div>

        <!-- Custom Icon URL -->
        <div>
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
            <ImageIcon class="w-3.5 h-3.5 text-zinc-400" />
            自定义图标 URL (选填)
          </label>
          <input
            v-model="customIconUrl"
            type="text"
            placeholder="留空则自动从网站或 DuckDuckGo 图标库获取"
            class="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
          />
        </div>

        <!-- Bookmark AI Prompt (Tier 3) -->
        <div class="pt-1">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-semibold">
              <Sparkles class="w-3.5 h-3.5 text-purple-500" />
              AI Agent 专属提示词 / 操作指南 (选填)
            </span>
            <span class="text-[10px] text-zinc-400 font-mono">Tier 3 SOP</span>
          </label>
          <textarea
            v-model="aiPrompt"
            rows="2"
            placeholder="告诉 AI 如何操作或读取该网站，例如：进入后直接访问 /dashboard 提取今日核心指标..."
            class="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none font-mono"
          ></textarea>
          <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            为自动化 Agent 或浏览器插件设定该站点的专属操作 SOP 与目标动作。
          </p>
        </div>

        <!-- Footer Buttons -->
        <div class="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-xs"
          >
            {{ isEditing ? '保存修改' : '确认添加' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
