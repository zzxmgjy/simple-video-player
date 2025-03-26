<script setup lang="ts">
import { onMounted } from 'vue'
import { useConfigStore } from './stores/config'
import { useTheme } from './composables/useTheme'

const configStore = useConfigStore()
const { isDark } = useTheme()

onMounted(async () => {
  await configStore.loadConfig()
})
</script>

<template>
  <div
    :class="[
      'min-h-screen transition-colors duration-0',
      isDark ? 'dark' : '',
      'bg-background-light dark:bg-background-dark'
    ]"
    :style="{
      backgroundImage: configStore.backgroundImage ? `url(${configStore.backgroundImage})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }"
  >
    <router-view />
  </div>
</template> 