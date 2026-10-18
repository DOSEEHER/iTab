<script setup lang="ts">
import { ref } from 'vue'
import type { Category, Bookmark } from '@/types'
import {
  X,
  Database,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from '@lucide/vue'

const {
  isOpen,
} = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'export'): void
  (e: 'import', payload: { categories: Category[]; bookmarks: Bookmark[] }): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const parsedData = ref<{ categories: Category[]; bookmarks: Bookmark[] } | null>(null)
const fileName = ref('')
const errorMessage = ref('')
const isImporting = ref(false)
const importSuccess = ref(false)

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  fileName.value = file.name
  errorMessage.value = ''
  importSuccess.value = false

  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const content = event.target?.result as string
      const parsed = JSON.parse(content)

      if (!parsed.categories || !Array.isArray(parsed.categories)) {
        throw new Error('无效的备份文件：缺少 categories 分类数据')
      }

      parsedData.value = {
        categories: parsed.categories,
        bookmarks: parsed.bookmarks || [],
      }
    } catch (err: unknown) {
      parsedData.value = null
      errorMessage.value = err instanceof Error ? err.message : '解析 JSON 备份文件失败'
    }
  }
  reader.readAsText(file)
}

const handleConfirmImport = async () => {
  if (!parsedData.value) return

  isImporting.value = true
  errorMessage.value = ''

  try {
    emit('import', parsedData.value)
    importSuccess.value = true
    setTimeout(() => {
      emit('close')
    }, 1200)
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : '导入数据失败'
  } finally {
    isImporting.value = false
  }
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
          <Database class="w-4 h-4 text-blue-500" />
          数据备份与恢复 (JSON)
        </h2>
        <button
          type="button"
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="mt-4 space-y-6">
        <!-- Export Section -->
        <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Download class="w-4 h-4 text-blue-500" />
                导出完整备份文件
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                将所有分类、书签及公开分享设置打包为标准 JSON 备份文件，下载保存至本地。
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white flex items-center gap-1.5 transition-all shadow-xs"
              @click="emit('export')"
            >
              <Download class="w-3.5 h-3.5" />
              <span>立即导出</span>
            </button>
          </div>
        </div>

        <!-- Import Section -->
        <div>
          <h3 class="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-1.5">
            <Upload class="w-4 h-4 text-emerald-500" />
            从备份文件恢复
          </h3>

          <div
            v-if="errorMessage"
            class="p-2.5 mb-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2"
          >
            <AlertTriangle class="w-4 h-4 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>

          <div
            v-if="importSuccess"
            class="p-2.5 mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2"
          >
            <CheckCircle2 class="w-4 h-4 shrink-0" />
            <span>数据导入成功！正在更新界面...</span>
          </div>

          <input
            ref="fileInputRef"
            type="file"
            accept=".json,application/json"
            class="hidden"
            @change="handleFileSelect"
          />

          <!-- Upload Drop area -->
          <div
            class="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer bg-zinc-50/50 dark:bg-zinc-800/20"
            @click="fileInputRef?.click()"
          >
            <FileJson class="w-8 h-8 mx-auto text-zinc-400 mb-2" />
            <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {{ fileName || '点击选择或拖拽 itab-backup-*.json 备份文件' }}
            </p>
            <p class="text-[11px] text-zinc-400 mt-1">
              支持批量导入分类与网址书签至 Cloudflare D1
            </p>
          </div>

          <!-- Preview Info if parsed -->
          <div
            v-if="parsedData"
            class="mt-3 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between"
          >
            <span>
              已读取: <strong>{{ parsedData.categories.length }}</strong> 个分类，<strong>{{ parsedData.bookmarks.length }}</strong> 条书签
            </span>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 flex items-center gap-1 transition-all"
              :disabled="isImporting"
              @click="handleConfirmImport"
            >
              <Loader2 v-if="isImporting" class="w-3 h-3 animate-spin" />
              <span>确认恢复</span>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            @click="emit('close')"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
