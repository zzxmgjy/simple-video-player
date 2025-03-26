import { ref } from 'vue'
import { usePreferredDark } from '@vueuse/core'

// 从 localStorage 获取主题设置，如果没有则使用系统偏好
const THEME_KEY = 'theme-preference'
const savedTheme = localStorage.getItem(THEME_KEY)
const isDark = ref(savedTheme !== null ? savedTheme === 'dark' : usePreferredDark().value)

export function useTheme() {
  const toggleTheme = () => {
    isDark.value = !isDark.value
    // 保存到 localStorage
    localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light')
    updateTheme()
  }

  const updateTheme = () => {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // 初始化主题
  updateTheme()

  return {
    isDark,
    toggleTheme,
  }
}