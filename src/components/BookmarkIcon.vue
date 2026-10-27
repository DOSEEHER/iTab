<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const {
  url,
  title,
  customIconUrl = '',
  size = 40,
} = defineProps<{
  url: string
  title: string
  customIconUrl?: string
  size?: number
}>()

// Current icon tier: 1 = custom, 2 = auto favicon, 3 = monogram fallback
const currentTier = ref<1 | 2 | 3>(customIconUrl ? 1 : 2)

// Reset tier when props change
watch(
  () => [url, customIconUrl],
  () => {
    currentTier.value = customIconUrl ? 1 : 2
  }
)

const hostname = computed(() => {
  try {
    const fullUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`
    return new URL(fullUrl).hostname
  } catch {
    return ''
  }
})

// Current image source
const currentSrc = computed(() => {
  if (currentTier.value === 1 && customIconUrl) {
    return customIconUrl
  }
  if (currentTier.value <= 2 && hostname.value) {
    return `https://www.google.com/s2/favicons?domain=${hostname.value}&sz=64`
  }
  return ''
})

const handleImageLoad = (event: Event) => {
  if (currentTier.value === 2) {
    const img = event.target as HTMLImageElement
    // Google returns a 16x16 generic globe icon when the favicon is not found for sz=64
    if (img.naturalWidth <= 16 && img.naturalHeight <= 16) {
      currentTier.value = 3
    }
  }
}

const handleImageError = () => {
  if (currentTier.value === 1) {
    // Custom icon failed -> try auto favicon
    currentTier.value = 2
  } else if (currentTier.value === 2) {
    // Auto favicon failed -> switch to SVG monogram avatar
    currentTier.value = 3
  }
}

// First character for monogram
const initialChar = computed(() => {
  const clean = title.trim()
  if (!clean) return '?'
  // If first char is ASCII letter/digit or unicode character (e.g. Chinese character)
  return clean.charAt(0).toUpperCase()
})

// Deterministic pastel/vibrant background color based on string hash
const colorPalette = [
  'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20',
  'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-500/20',
  'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border-violet-500/20',
  'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20',
  'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border-teal-500/20',
  'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-500/20',
  'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20',
  'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20',
  'bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 border-fuchsia-500/20',
]

const avatarStyleClass = computed(() => {
  let hash = 0
  const str = title || hostname.value || 'itab'
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % colorPalette.length
  return colorPalette[index]
})
</script>

<template>
  <div
    class="relative shrink-0 flex items-center justify-center rounded-xl overflow-hidden border transition-all duration-200 select-none"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :class="currentTier === 3 ? avatarStyleClass : 'bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/80'"
  >
    <!-- Tier 1 & 2: Image Rendering -->
    <img
      v-if="currentTier !== 3 && currentSrc"
      :src="currentSrc"
      :alt="title"
      loading="lazy"
      class="w-6 h-6 object-contain rounded-md"
      @load="handleImageLoad"
      @error="handleImageError"
    />

    <!-- Tier 3: Deterministic SVG / Monogram Avatar Fallback -->
    <span
      v-else
      class="font-bold text-sm tracking-tight"
    >
      {{ initialChar }}
    </span>
  </div>
</template>
