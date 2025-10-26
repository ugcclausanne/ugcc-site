import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: '.',
  plugins: [react()],
  server: {
    fs: {
      // allow loading CSS from project root (../assets)
      allow: [path.resolve(__dirname, '..')]
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
