<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import type { Bookmark } from '@/types'
import BookmarkIcon from './BookmarkIcon.vue'
import { activeAiPopoverId } from '@/composables/useAiPopover'
import {
  ExternalLink,
  Copy,
  Check,
  Pencil,
  Trash2,
  GripVertical,
  Sparkles,
  X,
} from '@lucide/vue'

const {
  bookmark,
  isReadOnly = false,
  categoryName = '',
  categoryAiPrompt = '',
} = defineProps<{
  bookmark: Bookmark
  isReadOnly?: boolean
  categoryName?: string
  categoryAiPrompt?: string
}>()

const emit = defineEmits<{
  (e: 'edit', bm: Bookmark): void
  (e: 'delete', bm: Bookmark): void
}>()

const isCopied = ref(false)
const copiedAiInstructions = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({
  top: '0px',
  left: '0px',
  width: '320px',
})

let closeTimer: ReturnType<typeof setTimeout> | null = null

const isPositioned = ref(false)

const isAiPopoverOpen = computed(() => activeAiPopoverId.value === bookmark.id)
const hasAiPrompt = computed(() => Boolean(bookmark.ai_prompt && bookmark.ai_prompt.trim()))

const cleanHostname = computed(() => {
  try {
    const full = /^https?:\/\//i.test(bookmark.url) ? bookmark.url : `https://${bookmark.url}`
    return new URL(full).hostname.replace(/^www\./, '')
  } catch {
    return bookmark.url
  }
})

const updatePosition = () => {
  if (!triggerRef.value) return
  const triggerRect = triggerRef.value.getBoundingClientRect()

  const popoverWidth = Math.min(320, window.innerWidth - 24)
  const popoverHeight = popoverRef.value?.offsetHeight || 180
  const gap = 8
  const screenPadding = 12
  const topHeaderOffset = 64 // Header height + safe margin

  // Calculate vertical space above and below trigger
  const spaceAbove = triggerRect.top - topHeaderOffset
  const spaceBelow = window.innerHeight - triggerRect.bottom - screenPadding

  let top = 0
  if (spaceAbove >= popoverHeight + gap) {
    // Enough space above: position above the button
    top = triggerRect.top - popoverHeight - gap
  } else if (spaceBelow >= popoverHeight + gap) {
    // Not enough space above (e.g. card is near header): position below the button
    top = triggerRect.bottom + gap
  } else {
    // If neither has ideal space, choose whichever side has more room
    if (spaceBelow > spaceAbove) {
      top = Math.max(topHeaderOffset, triggerRect.bottom + gap)
    } else {
      top = Math.max(topHeaderOffset, triggerRect.top - popoverHeight - gap)
    }
  }

  // Clamp vertical position within visible viewport
  if (top + popoverHeight > window.innerHeight - screenPadding) {
    top = Math.max(topHeaderOffset, window.innerHeight - popoverHeight - screenPadding)
  }

  // Horizontal positioning: align with trigger left, clamped within window bounds
  let left = triggerRect.left
  if (left + popoverWidth + screenPadding > window.innerWidth) {
    left = window.innerWidth - popoverWidth - screenPadding
  }
  if (left < screenPadding) {
    left = screenPadding
  }

  popoverStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(popoverWidth)}px`,
  }
  isPositioned.value = true
}

const openPopover = () => {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  updatePosition()
  activeAiPopoverId.value = bookmark.id
}

const handleTriggerMouseEnter = () => {
  openPopover()
}

const handleTriggerMouseLeave = () => {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    if (activeAiPopoverId.value === bookmark.id) {
      activeAiPopoverId.value = null
    }
  }, 200)
}

const handlePopoverMouseEnter = () => {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

const handlePopoverMouseLeave = () => {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    if (activeAiPopoverId.value === bookmark.id) {
      activeAiPopoverId.value = null
    }
  }, 200)
}

const handleTriggerClick = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  if (activeAiPopoverId.value === bookmark.id) {
    activeAiPopoverId.value = null
  } else {
    openPopover()
  }
}

const handleScrollOrResize = () => {
  if (!isAiPopoverOpen.value || !triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  // If the trigger has scrolled completely off screen, close popover
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    activeAiPopoverId.value = null
    return
  }
  updatePosition()
}

watch(isAiPopoverOpen, (open) => {
  if (open) {
    nextTick(() => {
      updatePosition()
    })
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
  } else {
    isPositioned.value = false
    window.removeEventListener('scroll', handleScrollOrResize, true)
    window.removeEventListener('resize', handleScrollOrResize)
  }
})

onClickOutside(
  popoverRef,
  () => {
    if (activeAiPopoverId.value === bookmark.id) {
      activeAiPopoverId.value = null
    }
  },
  { ignore: [triggerRef] }
)

onUnmounted(() => {
  if (activeAiPopoverId.value === bookmark.id) {
    activeAiPopoverId.value = null
  }
  if (closeTimer) clearTimeout(closeTimer)
  window.removeEventListener('scroll', handleScrollOrResize, true)
  window.removeEventListener('resize', handleScrollOrResize)
})

const handleCopy = async (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  try {
    await navigator.clipboard.writeText(bookmark.url)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 1800)
  } catch (err) {
    console.error('[Apple] Copy failed', err)
  }
}

const handleCopyAiInstructions = async (e: Event) => {
  e.preventDefault()
  e.stopPropagation()

  const lines = [
    `# 目标网址: ${bookmark.title}`,
    `URL: ${bookmark.url}`,
  ]
  if (categoryName) lines.push(`分类: ${categoryName}`)
  if (categoryAiPrompt?.trim()) lines.push(`分类准则: ${categoryAiPrompt.trim()}`)
  if (bookmark.ai_prompt?.trim()) lines.push(`专属操作 SOP: ${bookmark.ai_prompt.trim()}`)

  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copiedAiInstructions.value = true
    setTimeout(() => {
      copiedAiInstructions.value = false
    }, 1800)
  } catch (err) {
    console.error('[Apple] Copy failed', err)
  }
}

const handleEdit = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  emit('edit', bookmark)
}

const handleDelete = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  emit('delete', bookmark)
}
</script>

<template>
  <a
    :href="bookmark.url"
    target="_blank"
    rel="noopener noreferrer"
    class="group relative flex items-start gap-3 p-3 rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 cursor-pointer h-24 overflow-hidden"
    :data-id="bookmark.id"
  >
    <!-- Left Icon -->
    <BookmarkIcon
      :url="bookmark.url"
      :title="bookmark.title"
      :custom-icon-url="bookmark.custom_icon_url"
      :size="42"
      class="shrink-0"
    />

    <!-- Middle Info -->
    <div class="flex-1 min-w-0 pr-6 flex flex-col justify-between h-full">
      <div>
        <div class="flex items-center gap-1.5">
          <h3 class="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {{ bookmark.title }}
          </h3>
          <ExternalLink class="w-3 h-3 text-zinc-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <p
          v-if="bookmark.remark"
          class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-snug break-all"
        >
          {{ bookmark.remark }}
        </p>
      </div>

      <div class="mt-auto pt-1 flex items-center gap-2 flex-wrap">
        <span class="inline-flex items-center text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-full">
          {{ cleanHostname }}
        </span>

        <!-- AI Badge & Popover Trigger -->
        <div
          v-if="hasAiPrompt"
          ref="triggerRef"
          class="relative inline-flex items-center shrink-0"
          @mouseenter="handleTriggerMouseEnter"
          @mouseleave="handleTriggerMouseLeave"
        >
          <button
            type="button"
            title="查看 AI 专属操作指令"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all cursor-pointer shadow-2xs"
            @click="handleTriggerClick"
          >
            <Sparkles class="w-2.5 h-2.5 text-purple-500" />
            <span>AI</span>
          </button>

          <!-- Teleported Popover to escape card stacking contexts & header occlusion -->
          <Teleport to="body">
            <div
              v-if="isAiPopoverOpen && isPositioned"
              ref="popoverRef"
              :style="{ ...popoverStyle, zIndex: '9999' }"
              class="fixed p-3.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-purple-200/90 dark:border-purple-800/80 shadow-2xl text-left cursor-default select-text"
              @mouseenter="handlePopoverMouseEnter"
              @mouseleave="handlePopoverMouseLeave"
              @click.stop
            >
              <!-- Popover Header -->
              <div class="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-2.5">
                <div class="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <Sparkles class="w-3.5 h-3.5" />
                  <span>AI 操作指南 (SOP)</span>
                </div>

                <div class="flex items-center gap-1">
                  <!-- Copy SOP Button -->
                  <button
                    type="button"
                    title="复制完整 AI SOP"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-colors cursor-pointer"
                    @click="handleCopyAiInstructions"
                  >
                    <Check v-if="copiedAiInstructions" class="w-3 h-3 text-emerald-500" />
                    <Copy v-else class="w-3 h-3" />
                    <span>{{ copiedAiInstructions ? '已复制' : '复制' }}</span>
                  </button>

                  <!-- Close Button -->
                  <button
                    type="button"
                    title="关闭"
                    class="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    @click="activeAiPopoverId = null"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Category Guideline Banner (if present) -->
              <div
                v-if="categoryAiPrompt?.trim()"
                class="mb-2 p-2 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 text-[11px] text-purple-800 dark:text-purple-200 leading-snug"
              >
                <div class="font-semibold text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-0.5">
                  分类通用准则 ({{ categoryName || '当前分类' }})
                </div>
                <div>{{ categoryAiPrompt.trim() }}</div>
              </div>

              <!-- Prompt Content -->
              <div class="max-h-48 overflow-y-auto pr-1 text-xs text-zinc-700 dark:text-zinc-200 leading-relaxed font-mono whitespace-pre-wrap select-text">
                {{ bookmark.ai_prompt }}
              </div>
            </div>
          </Teleport>
        </div>
      </div>
    </div>

    <!-- Actions (Desktop Hover & Mobile) -->
    <div
      class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xs p-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs"
    >
      <!-- Copy Link Button (Visible in both admin & read-only) -->
      <button
        type="button"
        title="复制链接"
        class="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        @click="handleCopy"
      >
        <Check v-if="isCopied" class="w-3.5 h-3.5 text-emerald-500" />
        <Copy v-else class="w-3.5 h-3.5" />
      </button>

      <!-- Admin Only Actions -->
      <template v-if="!isReadOnly">
        <button
          type="button"
          title="编辑书签"
          class="p-1 rounded-md text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="handleEdit"
        >
          <Pencil class="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          title="删除书签"
          class="p-1 rounded-md text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="handleDelete"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>

        <!-- Drag Handle -->
        <span
          title="拖拽排序"
          class="drag-handle p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-grab active:cursor-grabbing hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click.prevent.stop
        >
          <GripVertical class="w-3.5 h-3.5" />
        </span>
      </template>
    </div>
  </a>
</template>
