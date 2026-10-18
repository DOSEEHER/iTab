<script setup lang="ts">
import { ref, computed, watch, useTemplateRef, nextTick } from 'vue'
import type { Category } from '@/types'
import {
  X,
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
  Bookmark,
  Star,
  Heart,
  Smile,
  Flame,
  Zap,
  Coffee,
  Music,
  Gamepad2,
} from '@lucide/vue'

const {
  isOpen,
  categoryToEdit = null,
} = defineProps<{
  isOpen: boolean
  categoryToEdit?: Category | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { name: string; icon: string; ai_prompt: string }): void
}>()

const nameInput = useTemplateRef<HTMLInputElement>('name-input')

const name = ref('')
const selectedIcon = ref('Folder')
const aiPrompt = ref('')
const errorMessage = ref('')

const isEditing = computed(() => Boolean(categoryToEdit))

const availableIcons = [
  { name: 'Folder', component: Folder },
  { name: 'Sparkles', component: Sparkles },
  { name: 'Code2', component: Code2 },
  { name: 'Palette', component: Palette },
  { name: 'Globe', component: Globe },
  { name: 'Terminal', component: Terminal },
  { name: 'BookOpen', component: BookOpen },
  { name: 'Cpu', component: Cpu },
  { name: 'Layers', component: Layers },
  { name: 'Compass', component: Compass },
  { name: 'Briefcase', component: Briefcase },
  { name: 'Bookmark', component: Bookmark },
  { name: 'Star', component: Star },
  { name: 'Heart', component: Heart },
  { name: 'Smile', component: Smile },
  { name: 'Flame', component: Flame },
  { name: 'Zap', component: Zap },
  { name: 'Coffee', component: Coffee },
  { name: 'Music', component: Music },
  { name: 'Gamepad2', component: Gamepad2 },
]

watch(
  () => isOpen,
  (open) => {
    if (open) {
      errorMessage.value = ''
      if (categoryToEdit) {
        name.value = categoryToEdit.name
        selectedIcon.value = categoryToEdit.icon || 'Folder'
        aiPrompt.value = categoryToEdit.ai_prompt || ''
      } else {
        name.value = ''
        selectedIcon.value = 'Folder'
        aiPrompt.value = ''
      }

      nextTick(() => {
        nameInput.value?.focus()
      })
    }
  },
  { immediate: true }
)

const handleSubmit = () => {
  if (!name.value.trim()) {
    errorMessage.value = '分类名称不能为空'
    return
  }

  emit('save', {
    name: name.value.trim(),
    icon: selectedIcon.value,
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
      class="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Folder class="w-4 h-4 text-blue-500" />
          {{ isEditing ? '编辑分类' : '新建分类' }}
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

        <!-- Name Input -->
        <div>
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            分类名称 <span class="text-rose-500">*</span>
          </label>
          <input
            ref="name-input"
            v-model="name"
            type="text"
            placeholder="例如: 常用工具、开发设计..."
            required
            class="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <!-- Icon Picker -->
        <div>
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            选择图标
          </label>
          <div class="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1 border border-zinc-100 dark:border-zinc-800/80 rounded-xl">
            <button
              v-for="iconItem in availableIcons"
              :key="iconItem.name"
              type="button"
              class="flex flex-col items-center justify-center p-2 rounded-xl border transition-all"
              :class="
                selectedIcon === iconItem.name
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 shadow-xs'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              "
              @click="selectedIcon = iconItem.name"
            >
              <component :is="iconItem.component" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Category AI Prompt (Tier 2) -->
        <div class="pt-1">
          <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-semibold">
              <Sparkles class="w-3.5 h-3.5 text-purple-500" />
              分类 AI 提示词 (可选)
            </span>
            <span class="text-[10px] text-zinc-400 font-mono">Tier 2 指令</span>
          </label>
          <textarea
            v-model="aiPrompt"
            rows="2"
            placeholder="给 AI Agent 的分类级指令，例如：访问此分类下的网站时重点关注..."
            class="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none font-mono"
          ></textarea>
          <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            Agent 访问本分类下的站点时将继承该指令，用于指导数据挖掘重点或操作侧重。
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
            {{ isEditing ? '保存修改' : '创建分类' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
