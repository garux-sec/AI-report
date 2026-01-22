import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://localhost:9000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:9000',
        changeOrigin: true
      }
    }
  }
})

