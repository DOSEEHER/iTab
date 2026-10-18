import { defineStore } from 'pinia'
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()

  const token = ref<string | null>(null)
  const expiresAt = ref<number | null>(null)
  const mode = ref<'persistent' | 'temporary' | null>(null)

  // Inactivity tracking for temporary login mode
  const lastActiveTimestamp = ref<number>(Date.now())
  const remainingSeconds = ref<number>(0)
  let timerId: ReturnType<typeof setInterval> | null = null
  let inactivityTimerId: ReturnType<typeof setInterval> | null = null

  const isAuthenticated = computed(() => {
    if (!token.value || !expiresAt.value) return false
    return Date.now() < expiresAt.value
  })

  const isTemporary = computed(() => mode.value === 'temporary')

  // Formatted countdown: HH:MM:SS
  const countdownFormatted = computed(() => {
    const totalSec = Math.max(0, remainingSeconds.value)
    const hours = Math.floor(totalSec / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const updateRemaining = () => {
    if (!expiresAt.value) {
      remainingSeconds.value = 0
      return
    }
    const diff = Math.floor((expiresAt.value - Date.now()) / 1000)
    if (diff <= 0) {
      remainingSeconds.value = 0
      logout()
    } else {
      remainingSeconds.value = diff
    }
  }

  const resetActivity = () => {
    lastActiveTimestamp.value = Date.now()
  }

  const checkInactivity = () => {
    if (mode.value !== 'temporary') return
    // 20 minutes inactivity check = 20 * 60 * 1000 ms
    const inactiveDuration = Date.now() - lastActiveTimestamp.value
    if (inactiveDuration > 20 * 60 * 1000) {
      console.warn('[Apple] Temporary session auto-locked due to 20m inactivity')
      logout()
    }
  }

  const startTimers = () => {
    stopTimers()
    updateRemaining()
    timerId = setInterval(updateRemaining, 1000)

    if (mode.value === 'temporary') {
      window.addEventListener('mousemove', resetActivity, { passive: true })
      window.addEventListener('keydown', resetActivity, { passive: true })
      window.addEventListener('touchstart', resetActivity, { passive: true })
      window.addEventListener('scroll', resetActivity, { passive: true })
      window.addEventListener('click', resetActivity, { passive: true })

      inactivityTimerId = setInterval(checkInactivity, 15000)
    }
  }

  const stopTimers = () => {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
    if (inactivityTimerId) {
      clearInterval(inactivityTimerId)
      inactivityTimerId = null
    }
    window.removeEventListener('mousemove', resetActivity)
    window.removeEventListener('keydown', resetActivity)
    window.removeEventListener('touchstart', resetActivity)
    window.removeEventListener('scroll', resetActivity)
    window.removeEventListener('click', resetActivity)
  }

  const initAuth = () => {
    // 1. Check sessionStorage first (temporary mode)
    const sessionToken = sessionStorage.getItem('itab_token')
    const sessionExpires = sessionStorage.getItem('itab_expires_at')
    const sessionMode = sessionStorage.getItem('itab_mode')

    if (sessionToken && sessionExpires && sessionMode === 'temporary') {
      const exp = Number(sessionExpires)
      if (Date.now() < exp) {
        token.value = sessionToken
        expiresAt.value = exp
        mode.value = 'temporary'
        startTimers()
        return true
      } else {
        sessionStorage.clear()
      }
    }

    // 2. Check localStorage (persistent mode)
    const localToken = localStorage.getItem('itab_token')
    const localExpires = localStorage.getItem('itab_expires_at')
    const localMode = localStorage.getItem('itab_mode')

    if (localToken && localExpires) {
      const exp = Number(localExpires)
      if (Date.now() < exp) {
        token.value = localToken
        expiresAt.value = exp
        mode.value = (localMode as 'persistent') || 'persistent'
        startTimers()
        return true
      } else {
        localStorage.removeItem('itab_token')
        localStorage.removeItem('itab_expires_at')
        localStorage.removeItem('itab_mode')
      }
    }

    token.value = null
    expiresAt.value = null
    mode.value = null
    return false
  }

  const login = async (username: string, password: string, isTemp: boolean) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, isTemporary: isTemp }),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error || '登录失败，请检查用户名和密码')
    }

    const data = await res.json<{
      token: string
      expiresAt: number
      mode: 'persistent' | 'temporary'
    }>()

    token.value = data.token
    expiresAt.value = data.expiresAt
    mode.value = data.mode

    if (data.mode === 'temporary') {
      // Clear local storage and store exclusively in sessionStorage
      localStorage.removeItem('itab_token')
      localStorage.removeItem('itab_expires_at')
      localStorage.removeItem('itab_mode')

      sessionStorage.setItem('itab_token', data.token)
      sessionStorage.setItem('itab_expires_at', data.expiresAt.toString())
      sessionStorage.setItem('itab_mode', data.mode)
    } else {
      sessionStorage.clear()
      localStorage.setItem('itab_token', data.token)
      localStorage.setItem('itab_expires_at', data.expiresAt.toString())
      localStorage.setItem('itab_mode', data.mode)
    }

    lastActiveTimestamp.value = Date.now()
    startTimers()
  }

  const logout = () => {
    stopTimers()
    token.value = null
    expiresAt.value = null
    mode.value = null

    sessionStorage.removeItem('itab_token')
    sessionStorage.removeItem('itab_expires_at')
    sessionStorage.removeItem('itab_mode')

    localStorage.removeItem('itab_token')
    localStorage.removeItem('itab_expires_at')
    localStorage.removeItem('itab_mode')

    if (router) {
      router.push('/login')
    }
  }

  const getAuthHeaders = (): Record<string, string> => {
    if (token.value) {
      return { Authorization: `Bearer ${token.value}` }
    }
    return {}
  }

  onUnmounted(() => {
    stopTimers()
  })

  return {
    token,
    expiresAt,
    mode,
    isAuthenticated,
    isTemporary,
    countdownFormatted,
    remainingSeconds,
    initAuth,
    login,
    logout,
    getAuthHeaders,
  }
})
