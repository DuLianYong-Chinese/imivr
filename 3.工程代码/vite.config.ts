import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// @ts-ignore
import fsPlugin from './vite/plugins/fs.mjs'

export default defineConfig({
  plugins: [
    react(),
    fsPlugin()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  define: {
    // 提供 Buffer polyfill
    global: 'globalThis',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: true
  },
  optimizeDeps: {
    include: ['gray-matter']
  }
})
