import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8880,
    watch: { usePolling: true },
    proxy: {
      '/api': {
        target: 'http://api:18081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 8880,
    strictPort: true,
    allowedHosts: [
      'shop.orangebeans.online',
      'localhost',
      '.localhost'
    ],
    proxy: {
      '/api': {
        target: 'http://api:18081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
