<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useBookmarkStore } from '@/stores/bookmarks'
import { useAuthStore } from '@/stores/auth'
import {
  X,
  Sparkles,
  Bot,
  Copy,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  Cpu,
  Terminal,
  Layers,
  FileText,
  Save,
  CheckCircle2,
  Info,
} from '@lucide/vue'

const { isOpen } = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const bookmarkStore = useBookmarkStore()
const authStore = useAuthStore()

const activeTab = ref<'global_prompt' | 'mcp_config'>('global_prompt')

const DEFAULT_GLOBAL_PROMPT =
  '这里是 iTab 个人专属网址与 AI 技能导航中心。请先读取分类列表与分类提示词以理解目录结构；在访问任何具体网址前，请务必遵循该网址卡片下绑定的专属 AI 提示词（Bookmark AI Prompt）执行操作。'

const localPrompt = ref('')
const isSaving = ref(false)
const saveSuccess = ref(false)

// Token visibility & copy states
const isTokenVisible = ref(false)
const copiedEndpoint = ref(false)
const copiedToken = ref(false)
const copiedConfig = ref(false)
const copiedLlmsUrl = ref(false)

const selectedClientType = ref<'streamable' | 'remote' | 'cursor'>('streamable')

// Sync prompt when modal opens
watch(
  () => isOpen,
  (val) => {
    if (val) {
      localPrompt.value = bookmarkStore.globalAgentPrompt || DEFAULT_GLOBAL_PROMPT
      saveSuccess.value = false
    }
  },
  { immediate: true }
)

const currentOrigin = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://itab.local'
})

const mcpEndpointUrl = computed(() => `${currentOrigin.value}/api/mcp`)

const rawToken = computed(() => bookmarkStore.mcpToken || '')

const maskedToken = computed(() => {
  if (!rawToken.value) return '••••••••••••••••••••••••••••••••'
  if (isTokenVisible.value) return rawToken.value
  return rawToken.value.slice(0, 7) + '••••••••••••••••••••' + rawToken.value.slice(-4)
})

const llmsUrl = computed(() => {
  if (!rawToken.value) return `${currentOrigin.value}/api/llms.txt`
  return `${currentOrigin.value}/api/llms.txt?token=${encodeURIComponent(rawToken.value)}`
})

// Ready-to-use client configurations
const clientConfigSnippet = computed(() => {
  const token = rawToken.value || '<YOUR_MCP_TOKEN>'
  const url = mcpEndpointUrl.value

  if (selectedClientType.value === 'streamable') {
    // Standard Streamable HTTP transport (Claude Desktop 2024-11+, Antigravity)
    return JSON.stringify(
      {
        mcpServers: {
          itab: {
            url,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        },
      },
      null,
      2
    )
  }

  if (selectedClientType.value === 'cursor') {
    // Cursor IDE MCP configuration
    return JSON.stringify(
      {
        name: 'itab',
        url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      null,
      2
    )
  }

  // Fallback: mcp-remote bridge for stdio-only clients
  return JSON.stringify(
    {
      mcpServers: {
        itab: {
          command: 'npx',
          args: ['-y', 'mcp-remote', url, '--header', `Authorization: Bearer ${token}`],
        },
      },
    },
    null,
    2
  )
})

const handleResetDefaultPrompt = () => {
  localPrompt.value = DEFAULT_GLOBAL_PROMPT
}

const handleSavePrompt = async () => {
  isSaving.value = true
  saveSuccess.value = false
  try {
    await bookmarkStore.updateGlobalAgentPrompt(localPrompt.value)
    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
    }, 2500)
  } catch (err) {
    alert(err instanceof Error ? err.message : '保存失败')
  } finally {
    isSaving.value = false
  }
}

const handleCopyEndpoint = async () => {
  try {
    await navigator.clipboard.writeText(mcpEndpointUrl.value)
    copiedEndpoint.value = true
    setTimeout(() => {
      copiedEndpoint.value = false
    }, 1800)
  } catch (err) {
    console.error('[Apple] Copy endpoint failed', err)
  }
}

const handleCopyToken = async () => {
  try {
    await navigator.clipboard.writeText(rawToken.value)
    copiedToken.value = true
    setTimeout(() => {
      copiedToken.value = false
    }, 1800)
  } catch (err) {
    console.error('[Apple] Copy token failed', err)
  }
}

const handleCopyLlmsUrl = async () => {
  try {
    await navigator.clipboard.writeText(llmsUrl.value)
    copiedLlmsUrl.value = true
    setTimeout(() => {
      copiedLlmsUrl.value = false
    }, 1800)
  } catch (err) {
    console.error('[Apple] Copy LLMs URL failed', err)
  }
}

const handleCopyConfig = async () => {
  try {
    await navigator.clipboard.writeText(clientConfigSnippet.value)
    copiedConfig.value = true
    setTimeout(() => {
      copiedConfig.value = false
    }, 1800)
  } catch (err) {
    console.error('[Apple] Copy config failed', err)
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm transition-all"
    @keydown.esc="emit('close')"
  >
    <div
      class="w-full max-w-2xl rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
    >
      <!-- Modal Header -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-purple-500/5 via-transparent to-blue-500/5"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-xs"
          >
            <Bot class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              AI Agent & MCP 控制台
            </h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              配置三级 AI 提示词及 MCP 服务
            </p>
          </div>
        </div>

        <button
          type="button"
          class="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tab Switcher -->
      <div class="px-6 pt-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex gap-2">
        <button
          type="button"
          class="px-4 py-2 text-xs font-medium rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer"
          :class="
            activeTab === 'global_prompt'
              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 bg-white dark:bg-zinc-900 shadow-xs'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          "
          @click="activeTab = 'global_prompt'"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>全局 AI 提示词</span>
        </button>

        <button
          type="button"
          class="px-4 py-2 text-xs font-medium rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer"
          :class="
            activeTab === 'mcp_config'
              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 bg-white dark:bg-zinc-900 shadow-xs'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          "
          @click="activeTab = 'mcp_config'"
        >
          <Cpu class="w-3.5 h-3.5" />
          <span>MCP 接入与配置</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- TAB 1: Global AI Prompt -->
        <div v-if="activeTab === 'global_prompt'" class="space-y-5">
          <!-- 3-Tier Architecture Flow Banner -->
          <div
            class="p-4 rounded-2xl bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-transparent border border-purple-500/10 dark:border-purple-500/20"
          >
            <div class="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
              <Layers class="w-4 h-4 text-purple-500" />
              <span>三级 AI 提示词体系</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-zinc-600 dark:text-zinc-400">
              <div class="p-2.5 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
                <span class="font-semibold text-purple-600 dark:text-purple-400">Tier 1 · 全局提示词</span>
                <p class="mt-1 leading-relaxed">整站总纲。描述 iTab 目录规范、分类逻辑与 Agent 行为守则。</p>
              </div>
              <div class="p-2.5 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
                <span class="font-semibold text-blue-600 dark:text-blue-400">Tier 2 · 分类提示词</span>
                <p class="mt-1 leading-relaxed">在分类编辑弹窗配置。指导 Agent 访问该类网站时的侧重目标。</p>
              </div>
              <div class="p-2.5 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
                <span class="font-semibold text-emerald-600 dark:text-emerald-400">Tier 3 · 书签提示词</span>
                <p class="mt-1 leading-relaxed">在书签卡片配置。包含进入该站点的具体 SOP、登录策略与执行动作。</p>
              </div>
            </div>
          </div>

          <!-- Prompt Textarea -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <FileText class="w-3.5 h-3.5 text-purple-500" />
                全局站点 AI 提示词
              </label>
              <button
                type="button"
                class="text-[11px] text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1 cursor-pointer transition-colors"
                @click="handleResetDefaultPrompt"
              >
                <RotateCcw class="w-3 h-3" />
                <span>恢复默认模版</span>
              </button>
            </div>

            <textarea
              v-model="localPrompt"
              rows="6"
              placeholder="请输入向 AI Agent 传达的全局结构定义和操作指导..."
              class="w-full px-3.5 py-3 rounded-2xl text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-mono leading-relaxed"
            ></textarea>
            <p class="text-[11px] text-zinc-400 dark:text-zinc-500">
              当 Agent 调用 MCP 的 <code class="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-purple-600 dark:text-purple-400 font-mono">get_itab_overview</code> 或 <code class="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-purple-600 dark:text-purple-400 font-mono">get_bookmark_agent_playbook</code> 时，将首先注入此全局指令。
            </p>
          </div>

          <!-- Save Actions -->
          <div class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400" v-if="saveSuccess">
              <CheckCircle2 class="w-4 h-4" />
              <span>全局提示词已成功持久化至 Cloudflare D1！</span>
            </div>
            <div v-else></div>

            <button
              type="button"
              class="px-5 py-2 rounded-xl text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              :disabled="isSaving"
              @click="handleSavePrompt"
            >
              <Save class="w-3.5 h-3.5" />
              <span>{{ isSaving ? '正在保存...' : '保存全局提示词' }}</span>
            </button>
          </div>
        </div>

        <!-- TAB 2: MCP Integration -->
        <div v-else-if="activeTab === 'mcp_config'" class="space-y-6">
          <!-- Temporary Mode Security Alert -->
          <div
            v-if="authStore.isTemporary"
            class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 space-y-2"
          >
            <div class="flex items-center gap-2 font-semibold text-xs">
              <ShieldAlert class="w-4 h-4" />
              <span>公共设备临时登录安全隔离</span>
            </div>
            <p class="text-xs leading-relaxed text-amber-600 dark:text-amber-300/90">
              当前处于临时登录模式 (Temporary Mode)，系统已依据零信任安全准则自动隐蔽 MCP Token 及全站 Agent 接入凭证。请在私人设备上登录以管理与复制 MCP 密钥。
            </p>
          </div>

          <!-- Normal Login: Show MCP Credentials -->
          <div v-else class="space-y-5">
            <!-- 1. MCP Endpoint URL -->
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Terminal class="w-3.5 h-3.5 text-blue-500" />
                MCP Endpoint URL
              </label>
              <div class="relative flex items-center">
                <input
                  type="text"
                  readonly
                  :value="mcpEndpointUrl"
                  class="w-full px-3 py-2 pr-20 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 select-all"
                />
                <button
                  type="button"
                  class="absolute right-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-700/70 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-1 transition-all cursor-pointer"
                  @click="handleCopyEndpoint"
                >
                  <Check v-if="copiedEndpoint" class="w-3 h-3 text-emerald-500" />
                  <Copy v-else class="w-3 h-3" />
                  <span>{{ copiedEndpoint ? '已复制' : '复制' }}</span>
                </button>
              </div>
            </div>

            <!-- 2. MCP Access Token -->
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                  <ShieldAlert class="w-3.5 h-3.5 text-purple-500" />
                  MCP Access Token
                </span>
                <span class="text-[11px] text-zinc-400">HMAC-SHA256 确定性衍生密钥</span>
              </label>
              <div class="relative flex items-center">
                <input
                  type="text"
                  readonly
                  :value="maskedToken"
                  class="w-full px-3 py-2 pr-28 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 select-all"
                />
                <div class="absolute right-1 flex items-center gap-1">
                  <button
                    type="button"
                    class="p-1 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors"
                    :title="isTokenVisible ? '隐藏明文' : '显示明文'"
                    @click="isTokenVisible = !isTokenVisible"
                  >
                    <EyeOff v-if="isTokenVisible" class="w-3.5 h-3.5" />
                    <Eye v-else class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-700/70 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-1 transition-all cursor-pointer"
                    @click="handleCopyToken"
                  >
                    <Check v-if="copiedToken" class="w-3 h-3 text-emerald-500" />
                    <Copy v-else class="w-3 h-3" />
                    <span>{{ copiedToken ? '已复制' : '复制' }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 3. LLMs.txt Direct Context Link -->
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                  <FileText class="w-3.5 h-3.5 text-emerald-500" />
                  全量上下文直链
                </span>
                <a
                  :href="llmsUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5"
                >
                  <span>新标签页预览</span>
                  <ExternalLink class="w-3 h-3" />
                </a>
              </label>
              <div class="relative flex items-center">
                <input
                  type="text"
                  readonly
                  :value="llmsUrl"
                  class="w-full px-3 py-2 pr-20 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 select-all"
                />
                <button
                  type="button"
                  class="absolute right-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-700/70 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-1 transition-all cursor-pointer"
                  @click="handleCopyLlmsUrl"
                >
                  <Check v-if="copiedLlmsUrl" class="w-3 h-3 text-emerald-500" />
                  <Copy v-else class="w-3 h-3" />
                  <span>{{ copiedLlmsUrl ? '已复制' : '复制' }}</span>
                </button>
              </div>
            </div>

            <!-- 4. Client Configuration Snippet Generator -->
            <div class="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Bot class="w-3.5 h-3.5 text-purple-500" />
                  客户端接入配置 (Client JSON Config)
                </label>

                <!-- Client Selector Tabs -->
                <div class="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px]">
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer"
                    :class="selectedClientType === 'streamable' ? 'bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-300 shadow-xs' : 'text-zinc-500'"
                    @click="selectedClientType = 'streamable'"
                  >
                    Claude / Antigravity
                  </button>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer"
                    :class="selectedClientType === 'cursor' ? 'bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-300 shadow-xs' : 'text-zinc-500'"
                    @click="selectedClientType = 'cursor'"
                  >
                    Cursor IDE
                  </button>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer"
                    :class="selectedClientType === 'remote' ? 'bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-300 shadow-xs' : 'text-zinc-500'"
                    @click="selectedClientType = 'remote'"
                  >
                    mcp-remote
                  </button>
                </div>
              </div>

              <!-- Code Box -->
              <div class="relative rounded-2xl bg-zinc-900 text-zinc-100 p-4 font-mono text-xs overflow-x-auto shadow-inner border border-zinc-800">
                <pre class="leading-relaxed"><code>{{ clientConfigSnippet }}</code></pre>
                <button
                  type="button"
                  class="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                  @click="handleCopyConfig"
                >
                  <Check v-if="copiedConfig" class="w-3 h-3 text-emerald-400" />
                  <Copy v-else class="w-3 h-3" />
                  <span>{{ copiedConfig ? '已复制' : '复制代码' }}</span>
                </button>
              </div>

              <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
                <div class="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
                  <Info class="w-3.5 h-3.5 text-blue-500" />
                  <span>MCP 工具概览：</span>
                </div>
                <p>• <strong>get_itab_overview</strong>: 获取全站分类及分类 AI 指南</p>
                <p>• <strong>search_bookmarks</strong>: 模糊匹配书签及卡片级 AI 提示词</p>
                <p>• <strong>get_bookmark_agent_playbook</strong>: 组合 3 级提示词生成复合执行 SOP</p>
                <p>• <strong>manage_category</strong> / <strong>manage_bookmark</strong>: 增删改排及自动爬虫补齐</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
