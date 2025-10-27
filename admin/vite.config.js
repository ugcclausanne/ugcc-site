import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

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
      const guess = (p) => {
        const ext = p.toLowerCase().split('.').pop()
        switch (ext) {
          case 'css': return 'text/css'
          case 'js': return 'application/javascript'
          case 'json': return 'application/json'
          case 'svg': return 'image/svg+xml'
          case 'png': return 'image/png'
          case 'jpg':
          case 'jpeg': return 'image/jpeg'
          case 'webp': return 'image/webp'
          case 'gif': return 'image/gif'
          default: return 'application/octet-stream'
        }
      }
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        if (req.url.startsWith('/assets/') || req.url.startsWith('/data/')) {
          const abs = path.join(rootDir, req.url.replace(/^\//, ''))
          fs.readFile(abs, (err, data) => {
            if (err) return next()
            res.statusCode = 200
            res.setHeader('Content-Type', guess(abs))
            res.end(data)
          })
          return
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
