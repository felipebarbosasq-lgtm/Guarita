import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Em desenvolvimento, as chamadas para /api vão para o servidor Node (porta 3001)
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } } },
  preview: { proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } } },
})
