import { ref, watch } from 'vue'

// Module-level singleton — safe for browser SPA; not SSR-safe
const STORAGE_KEY = 'schema-vis-theme'
const isDark = ref(localStorage.getItem(STORAGE_KEY) !== 'light')

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('light', !dark)
}

// Apply stored preference immediately on module load
applyTheme(isDark.value)

watch(isDark, (dark) => {
  applyTheme(dark)
  localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
})

export function useTheme() {
  const toggleTheme = () => {
    isDark.value = !isDark.value
  }
  return { isDark, toggleTheme }
}
