import { ref } from 'vue'
import { uuid } from '../utils/uuid'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

// Module-level singleton — safe for browser SPA; not SSR-safe (cross-request contamination)
const toasts = ref<Toast[]>([])

export function useToast() {
  const toast = (message: string, type: ToastType = 'success') => {
    const id = uuid()
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 3000)
  }
  return { toasts, toast }
}
