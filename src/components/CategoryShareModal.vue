<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Category } from '@/types'
import {
  X,
  Share2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Globe,
  Lock,
  FileText,
} from '@lucide/vue'

const {
  isOpen,
  category,
} = defineProps<{
  isOpen: boolean
  category: Category | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'save',
    payload: {
      id: number
      is_public: boolean
      share_slug: string | null
      share_description: string
    }
  ): void
}>()

const isPublic = ref(false)
const shareSlug = ref('')
const shareDescription = ref('')
const isCopied = ref(false)
const errorMessage = ref('')

watch(
  () => [isOpen, category],
  () => {
    if (isOpen && category) {
      errorMessage.value = ''
      isPublic.value = Boolean(category.is_public)
      shareSlug.value = category.share_slug || generateRandomSlug()
      shareDescription.value = category.share_description || ''
    }
  },
  { immediate: true }
)

function generateRandomSlug() {
  return Math.random().toString(36).substring(2, 6)
}

const handleResetSlug = () => {
  shareSlug.value = generateRandomSlug()
}

const fullShareUrl = computed(() => {
  if (typeof window === 'undefined') return `/${shareSlug.value}`
  return `${window.location.origin}/${shareSlug.value}`
})

const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(fullShareUrl.value)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('[Apple] Copy link error:', err)
  }
}

const handleSave = () => {
  if (!category) return

  if (isPublic.value) {
    const slug = shareSlug.value.trim()
    if (!slug) {
      errorMessage.value = '公开分享必须提供分享后缀 (Slug)'
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      errorMessage.value = '分享后缀只能包含英文字母、数字、下划线和连字符'
      return
    }
  }

  emit('save', {
    id: category.id,
    is_public: isPublic.value,
    share_slug: isPublic.value ? shareSlug.value.trim() : null,
    share_description: shareDescription.value.trim(),
  })
}
</script>

<template>
  <div
    v-if="isOpen && category"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm transition-all"
    @keydown.esc="emit('close')"
  >
    <div
      class="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Share2 class="w-4 h-4 text-emerald-500" />
            公开分享
          </h2>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            分类: <span class="font-medium text-zinc-800 dark:text-zinc-200">{{ category.name }}</span>
          </p>
        </div>
        <button
          type="button"
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="mt-5 space-y-5">
        <!-- Error Alert -->
        <div
          v-if="errorMessage"
          class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400"
        >
          {{ errorMessage }}
        </div>

        <!-- Toggle Switch -->
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80">
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              :class="isPublic ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'"
            >
              <Globe v-if="isPublic" class="w-4 h-4" />
              <Lock v-else class="w-4 h-4" />
            </div>
            <div>
              <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {{ isPublic ? '当前已公开分享' : '私有保密状态' }}
              </p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">
                {{ isPublic ? '任何人持有链接均可只读浏览该分类下的所有书签' : '仅在管理员登录后可见' }}
              </p>
            </div>
          </div>

          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="isPublic"
              type="checkbox"
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"
            ></div>
          </label>
        </div>

        <!-- Public Config (Rendered when public is enabled) -->
        <div v-if="isPublic" class="space-y-4 pt-2">
          <!-- Slug Input -->
          <div>
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              自定义分享后缀 (Slug)
            </label>
            <div class="flex items-center gap-2">
              <div class="relative flex-1 flex items-center">
                <span class="absolute left-3 text-xs text-zinc-400 font-mono select-none">/</span>
                <input
                  v-model="shareSlug"
                  type="text"
                  placeholder="frontend-tools"
                  class="w-full pl-5 pr-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>
              <button
                type="button"
                title="重置分享链接 (立即使旧链接失效)"
                class="px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                @click="handleResetSlug"
              >
                <RefreshCw class="w-3.5 h-3.5" />
                <span>重置</span>
              </button>
            </div>
            <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
              重置后缀后，旧分享链接将立即失效返回 404。
            </p>
          </div>

          <!-- Share Description -->
          <div>
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <FileText class="w-3.5 h-3.5 text-zinc-400" />
              公开页面副标题/描述 (选填)
            </label>
            <input
              v-model="shareDescription"
              type="text"
              placeholder="例如: 个人精选的高频前端效率工具，欢迎收藏..."
              class="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <!-- Share Link Box -->
          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-xs">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-zinc-500 font-medium">完整分享链接</span>
              <a
                :href="fullShareUrl"
                target="_blank"
                class="text-blue-500 hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>在新标签页打开</span>
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
            <div class="flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
              <span class="font-mono text-zinc-700 dark:text-zinc-300 truncate">
                {{ fullShareUrl }}
              </span>
              <button
                type="button"
                class="shrink-0 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
                @click="handleCopyLink"
              >
                <Check v-if="isCopied" class="w-3.5 h-3.5 text-emerald-500" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ isCopied ? '已复制' : '复制链接' }}</span>
              </button>
            </div>
          </div>
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
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-xs"
            @click="handleSave"
          >
            保存分享设置
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
