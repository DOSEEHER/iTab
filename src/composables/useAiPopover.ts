import { ref } from 'vue'

// Module-level shared active popover ID to ensure only one AI popover is open across all cards
export const activeAiPopoverId = ref<number | string | null>(null)
