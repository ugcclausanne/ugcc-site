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
    },
    // Dev helper: serve parent /assets/* via Vite's /@fs mapping
    middlewareMode: false,
    configureServer(server) {
      const rootDir = path.resolve(__dirname, '..')
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.startsWith('/assets/')) {
          req.url = `/@fs/${rootDir}${req.url}`
        }
        next()
      })
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
