import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, '_worker.ts'), // changed from _worker.js to _worker.ts
      formats: ['es'],
      fileName: '_worker'
    },
    rollupOptions: {
      external: ['__STATIC_CONTENT_MANIFEST']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
