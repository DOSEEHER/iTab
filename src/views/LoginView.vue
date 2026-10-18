<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDark, useToggle } from '@vueuse/core'
import {
  Lock,
  User,
  KeyRound,
  Loader2,
  SquareBookmark,
  Sun,
  Moon,
  ShieldCheck,
} from '@lucide/vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isDark = useDark({
  storageKey: 'itab-theme',
})
const toggleDark = useToggle(isDark)

const username = ref('')
const password = ref('')
const rememberMe = ref(true)
const isLoading = ref(false)
const errorMessage = ref('')

// 安全防护：每2秒仅能尝试一次登录
const COOLDOWN_DURATION_MS = 3000
const cooldownRemaining = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null
let cooldownEndTime = 0

const startCooldown = (durationMs = COOLDOWN_DURATION_MS) => {
  cooldownEndTime = Date.now() + durationMs
  cooldownRemaining.value = Math.max(1, Math.ceil(durationMs / 1000))

  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    const diff = cooldownEndTime - Date.now()
    if (diff <= 0) {
      cooldownRemaining.value = 0
      if (cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    } else {
      cooldownRemaining.value = Math.max(1, Math.ceil(diff / 1000))
    }
  }, 100)
}

onUnmounted(() => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
})

const handleLogin = async () => {
  if (cooldownRemaining.value > 0) {
    errorMessage.value = `安全防护生效中：请等待 ${cooldownRemaining.value} 秒后再试`
    return
  }

  if (isLoading.value) {
    return
  }

  if (!username.value.trim() || !password.value.trim()) {
    errorMessage.value = '请输入用户名和管理密码'
    return
  }

  // 立即开启 2 秒安全防护冷却
  startCooldown(COOLDOWN_DURATION_MS)

  isLoading.value = true
  errorMessage.value = ''

  try {
    const isTemporary = !rememberMe.value
    await authStore.login(username.value.trim(), password.value.trim(), isTemporary)
    const redirectPath = (route.query.redirect as string) || '/'
    router.push(redirectPath)
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : '登录失败，请检查密码'
    // 确保冷却计时器持续生效
    if (cooldownRemaining.value <= 0) {
      startCooldown(COOLDOWN_DURATION_MS)
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex flex-col items-center justify-center p-4 relative bg-zinc-50 dark:bg-zinc-950 transition-colors">
    <!-- Top Right Theme Switcher -->
    <div class="absolute top-5 right-5">
      <button
        type="button"
        title="切换主题"
        class="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-xs transition-colors"
        @click="toggleDark()"
      >
        <Sun v-if="isDark" class="w-4 h-4" />
        <Moon v-else class="w-4 h-4" />
      </button>
    </div>

    <!-- Login Card Container -->
    <div class="w-full max-w-md">
      <!-- Brand Logo & Header -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25 mb-3">
          <SquareBookmark class="w-6 h-6" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          iTab 管理控制台
        </h1>
      </div>

      <!-- Form Card -->
      <div class="rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 p-8 shadow-xl">
        <!-- Error Banner -->
        <div
          v-if="errorMessage"
          class="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2"
        >
          <Lock class="w-4 h-4 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <form class="space-y-4" @submit.prevent="handleLogin">
          <!-- Username Input -->
          <div>
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <User class="w-3.5 h-3.5 text-zinc-400" />
              账号
            </label>
            <input
              v-model="username"
              type="text"
              required
              autocomplete="username"
              placeholder="请输入"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
            />
          </div>

          <!-- Password Input -->
          <div>
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound class="w-3.5 h-3.5 text-zinc-400" />
              密码
            </label>
            <input
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="请输入"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
            />
          </div>

          <!-- Remember Me Checkbox -->
          <div class="pt-1">
            <label class="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                v-model="rememberMe"
                type="checkbox"
                class="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500/20 accent-blue-600 dark:bg-zinc-800"
              />
              <span class="text-xs text-zinc-600 dark:text-zinc-400">记住我</span>
            </label>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading || cooldownRemaining > 0"
            class="w-full mt-4 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
            <template v-else-if="cooldownRemaining > 0">
              <span>{{ cooldownRemaining }} 秒后重试</span>
            </template>
            <template v-else>
              <span>进入控制台</span>
            </template>
          </button>
        </form>

        <!-- Security Badge -->
        <div class="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
          <ShieldCheck class="w-3.5 h-3.5 text-emerald-500/80" />
          <span>安全防护已启用</span>
        </div>
      </div>

      <!-- Footer Info -->
      <p class="text-center text-[11px] text-zinc-400 dark:text-zinc-500 mt-6">
        support@xike.io
      </p>
    </div>
  </div>
</template>
